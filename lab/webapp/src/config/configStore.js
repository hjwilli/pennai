/* ~This file is part of the PennAI library~

Copyright (C) 2017 Epistasis Lab, University of Pennsylvania

PennAI is maintained by:
    - Heather Williams (hwilli@upenn.edu)
    - Weixuan Fu (weixuanf@upenn.edu)
    - William La Cava (lacava@upenn.edu)
    - Michael Stauffer (stauffer@upenn.edu)
    - and many other generous open source contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

(Autogenerated header, do not modify)

*/
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';
import data from '../data';


/**
* Helps redux app create redux app store with middleware, in this case the
* library 'thunk' to help with async calls and a logging library; these
* '...provides a third-party extension point between dispatching an action,
* and the moment it reaches the reducer'
* --- taken from: https://redux.js.org/advanced/middleware
* essentially, intercepts default redux behavior and allows things such as logging
* or asynchronous actions without having to make special accommodations
*/
const configStore = () => {
  const middleware = [thunk];

  if(process.env.NODE_ENV === 'development') {
    const logger = createLogger({ collapsed: true });
    middleware.push(logger);
  }

  return createStore(data, applyMiddleware(...middleware));
};

export default configStore;
