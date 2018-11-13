#!/bin/bash

REPORT_PATH="target/test-reports"
COVERAGE_PATH="target/test-reports/cobertura"

NOSE_TESTS="ai/tests/test_recommender.py ai/tests/test_ai.py ai/tests/test_ai_and_api_utils.py machine/test/learn_tests.py ai/tests/test_knowledgebase_loader.py ai/metalearning/tests/test_dataset_describe.py"

rm -f "${REPORT_PATH}/nose_xunit.xml"
rm -f "${REPORT_PATH}/html/nose.html"
rm -drf "${COVERAGE_PATH}"

mkdir -p target/test-reports/cobertura/html

nosetests -s --with-xunit --xunit-file="${REPORT_PATH}/nose_xunit.xml" --with-coverage  --cover-inclusive --cover-package=. --cover-xml --cover-xml-file="${COVERAGE_PATH}/nose_cover.xml" --cover-html --cover-html-dir="${COVERAGE_PATH}/html" $NOSE_TESTS
#nosetests -s --with-html --html-file="${REPORT_PATH}/html/nose.html" $NOSE_TESTS

rm .coverage