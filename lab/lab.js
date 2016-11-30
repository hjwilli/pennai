/* Modules */
require("./env"); // Load configuration variables
var http = require("http");
var path = require("path");
var EventEmitter = require("events").EventEmitter;
var mediator = new EventEmitter();
var _ = require("lodash");
var express = require("express");
var bodyParser = require("body-parser");
var multer = require("multer");
var compression = require("compression");
var favicon = require("serve-favicon");
var morgan = require("morgan");
var rp = require("request-promise");
var Promise = require("bluebird");
var WebSocketServer = require("ws").Server;
var db = require("./db").db;
/* App instantiation */
var app = express();
var jsonParser = bodyParser.json({
    limit: '100mb'
}); // Parses application/json
var upload = multer(); // Store files in memory as Buffer objects
app.use(compression()); // Compress all Express requests
app.use(favicon(path.join(__dirname, "public/favicon.ico"))); // Deal with favicon requests
app.use(express.static(path.join(__dirname, "public"), {
    index: false,
    maxAge: '1d'
})); // Static directory
app.use("/bower_components", express.static(path.join(__dirname, "bower_components"), {
    index: false,
    maxAge: '1d'
})); // Bower components
app.set("view engine", "jade"); // Jade template engine
app.use(morgan("tiny")); // Log requests

/* API */

// Registers webhooks
app.post("/api/v1/webhooks", jsonParser, (req, res) => {
    // Parse webhook request
    var webhook = req.body;
    var url = webhook.url;
    var objects = webhook.objects;
    var event = webhook.event;
    var objId = webhook.object_id;

    // Use John Gruber's URL regex
    var urlRegEx = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)\S+(?:[^\s`!\[\]{};:'".,?«»“”‘’]))/ig;
    // Validate
    if (!url || !urlRegEx.test(url)) {
        res.status(400);
        return res.send({
            error: "Invalid or empty URL"
        });
    } else if (objects !== "experiments") {
        res.status(400);
        return res.send({
            error: "Object is not 'experiments'"
        });
    } else if (event !== "started" && event !== "finished") {
        res.status(400);
        return res.send({
            error: "Event is not 'started' or 'finished'"
        });
    } else if (!objId) {
        // TODO Check object exists
        res.status(400);
        return res.send({
            error: "No object ID provided"
        });
    }

    // Register with mediator
    mediator.once(objects + ":" + objId + ":" + event, () => {
        // Send webhook response
        rp({
                uri: webhook.url,
                method: "POST",
                json: webhook,
                gzip: true
            })
            .catch(() => {}); // Ignore failures from missing webhooks
    });
    res.status(201);
    return res.send({
        status: "Registered",
        options: webhook
    });
});

// Downloads file
app.get("/api/v1/files/:id", (req, res, next) => {
    // Open file
    var gfs = new db.GridStore(db, db.toObjectID(req.params.id), "r", {
        promiseLibrary: Promise
    });
    gfs.open((err, gfs) => {
        // Set read head pointer to beginning of file
        gfs.seek(0, () => {
            // Read entire file
            gfs.read()
                .then((file) => {
                    res.setHeader("Content-Disposition", "attachment; filename=" + gfs.filename); // Set as download
                    res.setHeader("Content-Type", gfs.metadata.contentType); // MIME Type
                    res.send(file); // Send file
                })
                .catch((err) => {
                    next(err);
                });
        });
    });
});

// Get collection for all API db-based endpoints
app.param("collection", (req, res, next, collection) => {
    req.collection = db.collection(collection);
    return next();
});

// Return all entries
app.get("/api/v1/:collection", (req, res, next) => {
    req.collection.find({}).toArrayAsync()
        .then((results) => {
            res.send(results);
        })
        .catch((err) => {
            next(err);
        });
});

// Create new entry
app.post("/api/v1/:collection", jsonParser, (req, res, next) => {
    req.collection.insertAsync(req.body, {})
        .then((result) => {
            res.status(201);
            res.send(result.ops[0]);
        })
        .catch((err) => {
            next(err);
        });
});


// Return a batch
app.get("/api/v1/batches/:id", (req, res, next) => {
    db.batches.findByIdAsync(req.params.id)
        .then((result) => {
            if (result._experiments !== undefined) {
                db.experiments.find({
                        '_id': {
                            $in: result._experiments
                        }
                    }).toArrayAsync()
                    .then((exp) => {
                        var num_finished = 0
                        for (var i = 0; i < exp.length; i++) {
                            if (exp[i]._status == 'success' && exp[i].best_fitness_score !== undefined) {

                                num_finished += 1
                            }
                        }
                        //write progress to the database
                        result._progress = ((num_finished) / (result._num_experiments)) * 100 + '%';
                        if (result._progress == '100%') {
                            var finished_date = new Date();
                            db.batches.updateByIdAsync(req.params.id, {
                                    $set: {
                                        _finished: finished_date,
                                        _status: 'success',
                                    }
                                })
                                .catch((err) => {
                                    next(err);
                                });
                        }

                        result._experiments = exp;
                        res.send(result);
                    })
                    .catch((err) => {
                        next(err);
                    });
            } else {
                res.send(result);
            }
        })
        .catch((err) => {
            next(err);
        });
});


// Return single entry
app.get("/api/v1/:collection/:id", (req, res, next) => {
    req.collection.findByIdAsync(req.params.id)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            next(err);
        });
});



// Update existing entry
app.put("/api/v1/:collection/:id", jsonParser, (req, res, next) => {
    delete req.body._id; // Delete ID (will not update otherwise)
    req.collection.updateByIdAsync(req.params.id, {
            $set: req.body
        })
        .then((result) => {
            // Update returns the count of affected objects
            res.send((result === 1) ? {
                msg: "success"
            } : {
                msg: "error"
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Delete existing entry
app.delete("/api/v1/:collection/:id", (req, res, next) => {
    req.collection.removeByIdAsync(req.params.id)
        .then((result) => {
            // Remove returns the count of affected objects
            res.send((result === 1) ? {
                msg: "success"
            } : {
                msg: "error"
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Return all experiments for a project
app.get("/api/v1/projects/:id/experiments", (req, res, next) => {
    db.experiments.find({
            _project_id: db.toObjectID(req.params.id)
        }).toArrayAsync() // Get experiments for project
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            next(err);
        });
});

// Delete all experiments for a project
app.delete("/api/v1/projects/:id/experiments", (req, res, next) => {
    db.experiments.removeAsync({
            _project_id: db.toObjectID(req.params.id)
        }) // Get experiments for project
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            next(err);
        });
});

// Gets the status of an experiment
app.get("/api/v1/experiments/:id/status", (req, res, next) => {
    db.experiments.findByIdAsync(req.params.id, { _status: 1 })
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            next(err);
        });
});

// TODO Consider renaming API endpoint
// Constructs a project from an uploaded .json file
app.post("/api/v1/projects/schema", upload.single("schema"), (req, res, next) => {
    // Extract file name
    var name = req.file.originalname.replace(".json", "");
    // Extract .json as object
    var schema = JSON.parse(req.file.buffer.toString());
    // Set category as empty
    var category = '';

    // Store
    db.projects.insertAsync({
            name: name,
            schema: schema,
            category: category
        }, {})
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            next(err);
        });
});

// Adds a category for an existing project
app.put("/api/v1/projects/:id/category", jsonParser, (req, res, next) => {
    db.projects.updateByIdAsync(req.params.id, {
            $set: {
                category: req.body.category
            }
        })
        .then((result) => {
            res.send((result.ok === 1) ? {
                msg: "success"
            } : {
                msg: "error"
            });
        })
        .catch((err) => {
            next(err);
        });
});

var optionChecker = (schema, obj) => {
    /*for (var prop in schema) {
      var schemaField = schema[prop];
      var val = obj[prop];
      // Check field exists
      if (val === undefined) {
        return {error: "Field " + prop + " missing"};
      }
      // Check field is valid
      var type = schemaField.type;
      // int float bool string enum
      if (type === "int") {
        if (isNaN(val) ||  val % 1 !== 0) {
          return {error: "Field " + prop + " of type " + type + " is invalid"};
        }
      } else if (type === "float") {
        if (isNaN(val)) {
          return {error: "Field " + prop + " of type " + type + " is invalid"};
        }
      } else if (type === "bool") {
        // changed to accept bool as either boolean type or string type
        if (val !== true && val !== false && val != "true" && val != "false") {
          return {error: "Field " + prop + " of type " + type + " is invalid"};
        }
      } else if (type === "string") {
        if (val.length === 0) {
          return {error: "Field " + prop + " of type " + type + " is invalid"};
        }
      } else if (type === "enum") {
          // changed to allow check for both single and multiple val(s)
          var selected = val.split(',');
          for(var i = 0; i < selected.length; i++) {
            if (schemaField.values.indexOf(selected[i]) === -1) {
              return {error: "Field " + prop + " of type " + type + " is invalid"};
            }
          }
      }
    }*/
    return {
        success: "Options validated"
    };
};

var submitJob = (projId, options, files) => {
    return new Promise((resolve, reject) => {
        db.machines.find({}, {
                address: 1
            }).toArrayAsync() // Get machine hostnames
            .then((machines) => {
                var macsP = Array(machines.length);
                // Check machine capacities
                for (var i = 0; i < machines.length; i++) {
                    macsP[i] = rp({
                        uri: machines[i].address + "/projects/" + projId + "/capacity",
                        method: "GET",
                        data: null
                    });
                }

                // Loop over reponses
                Promise.any(macsP)
                    // First machine with capacity, so use
                    .then((availableMac) => {
                        availableMac = JSON.parse(availableMac);

                        // Create experiment
                        db.experiments.insertAsync({
                                _options: options,
                                _project_id: db.toObjectID(projId),
                                _machine_id: db.toObjectID(availableMac._id),
                                _files: [],
                                _status: "running"
                            }, {})
                            .then((exp) => {
                                options._id = exp.ops[0]._id.toString(); // Add experiment ID to sent options

                                var filesP = processFiles(exp.ops[0], files); // Add files to project
                                // Wait for file upload to complete
                                Promise.all(filesP)
                                    .then(() => {
                                        // Send project
                                        rp({
                                                uri: availableMac.address + "/projects/" + projId,
                                                method: "POST",
                                                json: options,
                                                gzip: true
                                            })
                                            .then((body) => {
                                                resolve(body);
                                            })
                                            .catch(() => {
                                                db.experiments.removeByIdAsync(exp.ops[0]._id); // Delete failed experiment
                                                reject({
                                                    error: "Experiment failed to run"
                                                });
                                            });
                                    })
                                    .catch((err) => {
                                        reject(err);
                                    });
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    })
                    // No machines responded, therefore fail
                    .catch(() => {
                        reject({
                            error: "No machine capacity available"
                        });
                    });
            })
            .catch((err) => {
                reject(err);
            });
    });
};

// Constructs an experiment
app.post("/api/v1/projects/:id/experiment", /*jsonParser,*/ upload.array("_files"), (req, res, next) => {
    var projId = req.params.id;
    // Check project actually exists
    db.projects.findByIdAsync(projId, {
            schema: 1
        })
        .then((project) => {
            if (project === null) {
                res.status(400);
                res.send({
                    error: "Project ID " + projId + " does not exist"
                });
            } else {
                var obj = Object.assign(req.query, req.body);
                var files = req.files;

                // Validate
                var validation = optionChecker(project.schema, obj);
                if (validation.error) {
                    res.status(400);
                    res.send(validation);
                } else {
                    submitJob(projId, obj, files)
                        .then((resp) => {
                            res.status(201);
                            res.send(resp);
                        })
                        .catch((err) => {
                            // TODO Check comprehensiveness of error catching
                            if (err.error === "No machine capacity available") {
                                res.status(501);
                                res.send(err);
                            } else if (err.error === "Experiment failed to run") {
                                res.status(500);
                                res.send(err);
                            } else {
                                next(err);
                            }
                        });
                }
            }
        })
        .catch((err) => {
            next(err);
        });
});

// Submit job with retry
var submitJobRetry = function(projId, options, batch_id, retryT) {
    submitJob(projId, options)
        .then((foo) => {
            // Update batch with experiment id
            experiment_id = foo._id.toString();
            db.batches.updateByIdAsync(batch_id, {
                    $push: {
                        _experiments: db.toObjectID(experiment_id)
                    }
                })
                .then((result) => {
                    // Update returns the count of affected objects
                    res.send((result === 1) ? {
                        msg: "success"
                    } : {
                        msg: "error"
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch(() => {
            // Retry in a random 1s interval
            setTimeout(() => {
                submitJobRetry(projId, options, batch_id, retryT);
            }, 1000 * retryT * Math.random());
        });
};

// Constructs a batch job from a list of options
app.post("/api/v1/projects/:id/batch", jsonParser, (req, res, next) => {
    var num_experiments = req.body.length;
    var projId = req.params.id;
    var retryTimeout = parseInt(req.query.retry);
    // Set default as an hour
    if (isNaN(retryTimeout) || retryTimeout <= 0) {
        retryTimeout = 60 * 60;
    }
    // Check project actually exists
    db.projects.findByIdAsync(projId, {
            schema: 1
        })
        .then((project) => {
            if (project === null) {
                res.status(400);
                res.send({
                    error: "Project ID " + projId + " does not exist"
                });
            } else {
                var expList = req.body;
                // Validate
                var validationList = [];
                for (var i = 0; i < expList.length; i++) {
                    var validation = optionChecker(project.schema, expList[i]);
                    if (validation.error) {
                        validationList.push(validation);
                    }
                }
                if (validationList.length > 0) {
                    res.status(400);
                    res.send(validationList[0]); // Send first validation error       
                } else {
                    // Create batch
                    db.batches.insertAsync({
                            _project_id: db.toObjectID(projId),
                            _status: "running",
                            _num_experiments: num_experiments,
                            _started: new Date()
                        }, {})
                        .then((result) => {
                            batch_id = result.ops[0]._id.toString();
                            for (var j = 0; j < expList.length; j++) {
                                submitJobRetry(projId, expList[j], batch_id, retryTimeout);
                            }
                            res.send({
                                status: "Started",
                                _id: batch_id
                            });
                            res.send(result);
                        })
                        .catch((err) => {
                            next(err);
                        });
                    // Loop over jobs
                }
            }
        })
        .catch((err) => {
            next(err);
        });
});

// Adds started time to experiment
app.put("/api/v1/experiments/:id/started", (req, res, next) => {
    mediator.emit("experiments:" + req.params.id + ":started"); // Emit event

    db.experiments.updateByIdAsync(req.params.id, {
            $set: {
                _started: new Date()
            }
        })
        .then((result) => {
            // Update returns the count of affected objects
            res.send((result === 1) ? {
                msg: "success"
            } : {
                msg: "error"
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Adds finished time to experiment
app.put("/api/v1/experiments/:id/finished", (req, res, next) => {
    mediator.emit("experiments:" + req.params.id + ":finished"); // Emit event

    db.experiments.updateByIdAsync(req.params.id, {
            $set: {
                _finished: new Date()
            }
        })
        .then((result) => {
            // Update returns the count of affected objects
            res.send((result === 1) ? {
                msg: "success"
            } : {
                msg: "error"
            });
        })
        .catch((err) => {
            next(err);
        });
});

var processFiles = function(experiment, files) {
    var filesP = [];
    if (files !== undefined) {
        filesP = Array(files.length);

        var _saveGFSFile = function(fileId, fileObj, replace) {
            // Open new file
            var gfs = new db.GridStore(db, fileId, fileObj.originalname, "w", {
                metadata: {
                    contentType: fileObj.mimetype
                },
                promiseLibrary: Promise
            });
            gfs.open((err, gfs) => {
                if (err) {
                    console.log(err);
                } else {
                    // Write from buffer and flush to db
                    gfs.write(fileObj.buffer, true)
                        .then((gfs) => {
                            if (!replace) {
                                // Save file reference
                                filesP[i] = db.experiments.updateByIdAsync(experiment._id, {
                                    $push: {
                                        _files: {
                                            _id: gfs.fileId,
                                            filename: gfs.filename,
                                            mimetype: gfs.metadata.contentType
                                        }
                                    }
                                });
                            }
                        })
                        .catch((err) => {
                            console.log(err);
                        });
                }
            });
        };

        var saveGFSFile = function(fileObj) {
            // Check if file needs to be replaced
            var oldFile = _.find(experiment._files, {
                filename: fileObj.originalname
            });
            if (oldFile) {
                // Delete old file
                var gfs = new db.GridStore(db, oldFile._id, "w", {
                    promiseLibrary: Promise
                });
                gfs.unlinkAsync()
                    .then(() => {
                        _saveGFSFile(oldFile._id, fileObj, true);
                    })
                    .catch((err) => {
                        console.log(err);
                    });
            } else {
                // Save new file with new ID
                _saveGFSFile(new db.ObjectID(), fileObj, false);
            }
        };

        for (var i = 0; i < files.length; i++) {
            saveGFSFile(files[i]); // Save file in function closure
        }
    }

    return filesP;
};

// Processess files for an experiment
app.put("/api/v1/experiments/:id/files", upload.array("_files"), (req, res, next) => {
    // Retrieve list of files for experiment
    db.experiments.findByIdAsync(req.params.id, {
            _files: 1
        })
        .then((experiment) => {

            // Process files
            var filesP = processFiles(experiment, req.files);

            // Check file promises
            Promise.all(filesP)
                .then(() => {
                    res.send({
                        message: "Files uploaded"
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            console.log(err);
            next(err);
        });
});

// Delete all files for an experiment
app.delete("/api/v1/experiments/:id/files", (req, res, next) => {
    db.experiments.findByIdAsync(req.params.id, {
            _files: 1
        })
        .then((experiment) => {
            var filesP = Array(experiment._files.length);

            for (var i = 0; i < experiment._files.length; i++) {
                var gfs = new db.GridStore(db, experiment._files[i]._id, "w", {
                    promiseLibrary: Promise
                });
                filesP[i] = gfs.unlinkAsync();
            }

            // Check file promises
            Promise.all(filesP)
                .then(() => {
                    res.send({
                        message: "Files deleted"
                    });
                })
                .catch((err) => {
                    console.log(err);
                    next(err);
                });
        })
        .catch((err) => {
            console.log(err);
            next(err);
        });
});

// Delete all files for a project
app.delete("/api/v1/projects/:id/experiments/files", (req, res, next) => {
    db.experiments.find({
            _project_id: db.toObjectID(req.params.id)
        }).toArrayAsync() // Get experiments for project
        .then((experiments) => {
            var numFiles = 0;
            for (var i = 0; i < experiments.length; i++) {
                numFiles += experiments[i]._files.length;
            }
            var filesP = Array(numFiles);

            // Loop over experiments
            var fileIndex = 0;
            for (var j = 0; j < experiments.length; j++) {
                var experiment = experiments[j];
                // Loop over files
                for (var k = 0; k < experiment._files.length; k++) {
                    var gfs = new db.GridStore(db, experiment._files[k]._id, "w", {
                        promiseLibrary: Promise
                    });
                    filesP[fileIndex++] = gfs.unlinkAsync();
                }
            }

            // Check file promises
            Promise.all(filesP)
                .then(() => {
                    res.send({
                        message: "Files deleted"
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            next(err);
        });
});

// Registers machine projects
app.post("/api/v1/machines/:id/projects", jsonParser, (req, res, next) => {
    db.machines.findByIdAsync(req.params.id)
        .then((result) => {
            // Fail if machine does not exist
            if (result === null) {
                res.status(404);
                return res.send({
                    error: "Machine ID " + req.params.id + " does not exist"
                });
            }
            // Register projects otherwise
            db.machines.updateByIdAsync(req.params.id, {
                    $set: req.body
                })
                .then((result) => {
                    // Update returns the count of affected objects
                    res.send((result === 1) ? {
                        msg: "success"
                    } : {
                        msg: "error"
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            next(err);
        });
});

/* Rendering Routes */

// List projects and machines on homepage
app.get("/", (req, res, next) => {
    var category = req.query.cat;

    if (!category) {
        return res.render("base-index");
    }

    var projP = db.projects.find({
        category: category.toUpperCase()
    }, {
        name: 1
    }).sort({
        name: 1
    }).toArrayAsync(); // Get project names
    var macP = db.machines.find({}, {
        address: 1,
        hostname: 1
    }).sort({
        hostname: 1
    }).toArrayAsync(); // Get machine addresses and hostnames
    Promise.all([projP, macP])
        .then((results) => {
            return res.render("index", {
                projects: results[0],
                machines: results[1]
            });
        })
        .catch((err) => {
            return next(err);
        });
});

// List projects and machines on admin page
app.get("/admin", (req, res, next) => {
    var projP = db.projects.find({}, {
        name: 1,
        category: 1
    }).sort({
        name: 1
    }).toArrayAsync(); // Get project names
    var macP = db.machines.find({}, {
        address: 1,
        hostname: 1
    }).sort({
        hostname: 1
    }).toArrayAsync(); // Get machine addresses and hostnames
    Promise.all([projP, macP])
        .then((results) => {
            return res.render("admin", {
                projects: results[0],
                machines: results[1]
            });
        })
        .catch((err) => {
            return next(err);
        });
});

// Project page (new experiment)
app.get("/projects/:id", (req, res, next) => {
    db.projects.findByIdAsync(req.params.id)
        .then((result) => {
            res.render("project", {
                project: result
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Project page (optimisation)
app.get("/projects/:id/optimisation", (req, res, next) => {
    db.projects.findByIdAsync(req.params.id)
        .then((result) => {
            res.render("optimisation", {
                project: result
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Project page (experiments)
app.get("/projects/:id/experiments", (req, res, next) => {
    var projP = db.projects.findByIdAsync(req.params.id);
    var expP = db.experiments.find({
        _project_id: db.toObjectID(req.params.id)
    }, {
        _scores: 1,
        _status: 1,
        _options: 1,
        _started: 1,
        _finished: 1,
        _notes: 1
    }).toArrayAsync();
    Promise.all([projP, expP])
        .then((results) => {
            res.render("experiments", {
                project: results[0],
                experiments: results[1]
            });
        })
        .catch((err) => {
            next(err);
        });
});

// Machine page
app.get("/machines/:id", (req, res, next) => {
    db.machines.findByIdAsync(req.params.id)
        .then((mac) => {
            var projKeys = _.keys(mac.projects); // Extract project IDs
            projKeys = _.map(projKeys, db.toObjectID); // Map to MongoDB IDs
            db.projects.find({
                    _id: {
                        $in: projKeys
                    }
                }, {
                    name: 1
                }).sort({
                    name: 1
                }).toArrayAsync()
                .then((projects) => {
                    // Return only projects existing in FGLab
                    res.render("machine", {
                        machine: mac,
                        projects: projects
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            next(err);
        });
});


// Experiment page
app.get("/experiments/:id", (req, res, next) => {
    db.experiments.findByIdAsync(req.params.id)
        .then((result) => {
            var projP = db.projects.findByIdAsync(result._project_id, {
                name: 1
            }); // Find project name
            var macP = db.machines.findByIdAsync(result._machine_id, {
                hostname: 1,
                address: 1
            }); // Find machine hostname and address
            Promise.all([projP, macP])
                .then((results) => {
                    res.render("experiment", {
                        experiment: result,
                        project: results[0],
                        machine: results[1]
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            next(err);
        });
});


// Experiment page
app.get("/batches/:id", (req, res, next) => {
    db.batches.findByIdAsync(req.params.id)
        .then((result) => {
            var projP = db.projects.findByIdAsync(result._project_id, {
                name: 1
            }); // Find project name
            var macP = db.machines.findByIdAsync(result._machine_id, {
                hostname: 1,
                address: 1
            }); // Find machine hostname and address
            Promise.all([projP, macP])
                .then((results) => {
                    res.render("experiment", {
                        experiment: result,
                        project: results[0],
                        machine: results[1]
                    });
                })
                .catch((err) => {
                    next(err);
                });
        })
        .catch((err) => {
            next(err);
        });
});



/* Errors */
// Error handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err); // Delegate to Express' default error handling
    }
    res.status(500);
    res.send("Error: " + err);
});

/* HTTP server */
var server = http.createServer(app); // Create HTTP server
if (!process.env.FGLAB_PORT) {
    console.log("Error: No port specified");
    process.exit(1);
} else {
    // Listen for connections
    server.listen(process.env.FGLAB_PORT, () => {
        console.log("Server listening on port " + process.env.FGLAB_PORT);
    });
}

/* WebSocket server */
// Add websocket server
var wss = new WebSocketServer({
    server: server
});
// Catches errors to prevent FGMachine crashing if browser disconnect undetected
var wsErrHandler = function() {};

// Call on connection from new client
wss.on("connection", (ws) => {
    // Print received messages
    ws.on("message", (message) => {
        console.log(message);
    });

    // Perform clean up if necessary
    ws.on("close", () => {
        //console.log("Client closed connection");
    });
});