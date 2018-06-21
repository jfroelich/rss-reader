import '/src/control/archive-control-test.js';
import '/src/control/feed-control-test.js';
import '/src/argb8888/argb8888-test.js';
import '/src/dom/coerce-element-test.js';
import '/src/dom/set-document-base-uri-test.js';
import '/src/favicon/favicon-service-test.js';
import '/src/filters/boilerplate-test.js';
import '/src/filters/color-contrast-filter-test.js';
import '/src/filters/empty-attribute-filter-test.js';
import '/src/html/truncate-html-test.js';
import '/src/indexeddb/indexeddb-test.js';
import '/src/lang/filter-unprintable-characters-test.js';
import '/src/net/fetch-feed-test.js';
import '/src/net/fetch-html-test.js';
import '/src/net/load-url-test.js';
import '/src/net/mime-test.js';
import '/src/net/sniff-test.js';
import '/src/nlp/filter-publisher-test.js';
import '/src/opml/import-opml-test.js';
import '/src/parse-feed/parse-feed-test.js';
import '/src/rewrite-url/rewrite-url-test.js';
import {get_registry} from '/src/test/test-registry.js';

// Wrap a call to a test function with some extra log messages. Impose an
// optional deadline for the test to complete by specifying a timeout.
async function run_timed_test(test_function, timeout = 0) {
  console.log('%s: started', test_function.name);

  // The test will fail either immediately when creating the promise, or later
  // when awaiting the promise when the test has rejected, or after the timeout
  // occurred. We throw an error in all 3 cases. Note that in the timeout case
  // we ignore the test result (pass or error) and throw a timeout error
  // instead.

  // In the case of a timeout, we do not abort the test, because promises are
  // not cancelable.

  if (timeout) {
    const test_promise = test_function();
    const timeout_promise = deferred_rejection(test_function, timeout);
    await Promise.race([test_promise, timeout_promise]);
  } else {
    await test_function();
  }

  console.log('%s: completed', test_function.name);
}

function deferred_rejection(test_function, time_ms) {
  const error = new Error('Test ' + test_function.name + ' timed out');
  return new Promise((_, reject) => setTimeout(reject, time_ms, error));
}

// Lookup a test function by the function's name
function find_test_by_name(name) {
  // Allow for either - or _ as separator and mixed case
  let normal_test_name = name.replace(/-/g, '_').toLowerCase();

  const tests = get_registry();
  for (const test_function of tests) {
    if (test_function.name === normal_test_name) {
      return test_function;
    }
  }
}

// Run one or more tests either all at once or one after the other. In either
// case, if any test fails, the function exits (but tests may still run
// indefinitely).
// @param name {String} optional, name of test to run, if not specified then all
// tests run
// @param timeout {Number} optional, ms, per-test timeout value
// @param parallel {Boolean} optional, whether to run tests in parallel or
// serial, defaults to false (serial)
async function cli_run(name, timeout = 10000, parallel) {
  if (!['undefined', 'string'].includes(typeof name)) {
    throw new TypeError('Invalid name parameter ' + name);
  }

  // Either create an array of one test, or get all tests in the registry
  let tests;
  if (name) {
    const test = find_test_by_name(name);
    if (!test) {
      console.warn('Test not found', name);
      return;
    }
    tests = [test];
  } else {
    tests = get_registry();
  }

  console.log('Spawning %d tests', tests.length);
  const start_time = new Date();

  if (parallel) {
    const promises = [];
    for (const test of tests) {
      promises.push(run_timed_test(test, timeout));
    }
    await Promise.all(promises);
  } else {
    for (const test of tests) {
      await run_timed_test(test, timeout);
    }
  }

  const end_time = new Date();
  console.log('Completed in %d ms', end_time - start_time);
}

function cli_print_tests() {
  const tests = get_registry();
  tests.forEach(test => console.log(test.name));
}

function populate_test_menu() {
  const tests = get_registry();
  const menu = document.getElementById('tests');
  for (const test of tests) {
    const option = document.createElement('option');
    option.value = test.name;
    option.textContent = test.name.replace(/_/g, '-').toLowerCase();
    menu.appendChild(option);
  }
}

// On module load, expose console commands
window.run = cli_run;
window.print_tests = cli_print_tests;

// On module load, populate the tests menu
populate_test_menu();
