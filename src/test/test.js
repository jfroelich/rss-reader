import * as cdb_tests from '/src/core/db/cdb-tests.js';
import * as db_tests from '/src/core/db/db-tests.js';
import * as dom_filter_tests from '/src/core/dom-filters/dom-filter-tests.js';
import * as favicon_tests from '/src/core/favicon-tests.js';
import {fetch_feed_test} from '/src/core/net/fetch-feed-test.js';
import {fetch_html_test} from '/src/core/net/fetch-html-test.js';
import {fetch_image_element_test} from '/src/core/net/fetch-image-element-test.js';
import {fetch_image_test} from '/src/core/net/fetch-image-test.js';
import * as net_tests from '/src/core/net/net-tests.js';
import * as ops_tests from '/src/core/ops-tests.js';
import * as rewrite_url_tests from '/src/core/rewrite-url-test.js';
import * as array_utils_tests from '/src/lib/array-utils-tests.js';
import {coerce_element_test} from '/src/lib/coerce-element-test.js';
import {color_contrast_filter_test} from '/src/lib/color-contrast-filter-test.js';
import {color_test} from '/src/lib/color-test.js';
import * as document_utils_tests from '/src/lib/document-utils-tests.js';
import {filter_publisher_test} from '/src/lib/filter-publisher-test.js';
import * as html_utils_tests from '/src/lib/html-utils-tests.js';
import * as idb_tests from '/src/lib/idb-test.js';
import {mime_test} from '/src/lib/mime-test.js';
import {parse_feed_test} from '/src/lib/parse-feed-test.js';
import {sniffer_test} from '/src/lib/sniffer-test.js';
import * as string_utils_tests from '/src/lib/string-utils-tests.js';
import * as unwrap_element_tests from '/src/lib/unwrap-element-tests.js';
import * as url_utils_tests from '/src/lib/url-utils-tests.js';

const registry = [];
register_module_tests(array_utils_tests);
register_test(coerce_element_test);
register_test(color_contrast_filter_test);
register_test(color_test);
register_module_tests(cdb_tests);
register_module_tests(db_tests);
register_module_tests(document_utils_tests);
register_module_tests(dom_filter_tests);
register_module_tests(favicon_tests);
register_test(fetch_feed_test);
register_test(fetch_html_test);
register_test(fetch_image_test);
register_test(fetch_image_element_test);
register_test(filter_publisher_test);
register_module_tests(html_utils_tests);
register_module_tests(idb_tests);
register_test(mime_test);
register_module_tests(net_tests);
register_module_tests(ops_tests);
register_test(parse_feed_test);
register_module_tests(rewrite_url_tests);
register_test(sniffer_test);
register_module_tests(string_utils_tests);
register_module_tests(unwrap_element_tests);
register_module_tests(url_utils_tests);

// On module load, expose console commands
window.run = cli_run;
window.print_tests = cli_print_tests;

// On module load, populate the tests menu
populate_test_menu();

function register_module_tests(mod) {
  for (const id in mod) {
    // obj.prop notation does not work here
    // TODO: switch to endsWith as a stricter condition?
    if (typeof mod[id] === 'function' && id.includes('_test')) {
      register_test(mod[id]);
    }
  }
}

function register_test(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn is not a function: ' + fn);
  }

  if (registry.includes(fn)) {
    console.warn('Ignoring duplicate test registration:', fn.name);
    return;
  }

  registry.push(fn);
}

// Wrap a call to a test function with some extra log messages. Impose an
// optional deadline for the test to complete by specifying a timeout.
async function run_timed_test(test_function, timeout = 0) {
  console.log('%s: started', test_function.name);

  // The test will fail either immediately when creating the promise, or later
  // when awaiting the promise when the test has rejected, or after the timeout
  // occurred. We throw an error in all 3 cases. Note that in the timeout case
  // we ignore the test result (pass or error) and throw a timeout error
  // instead. Also note that in the case of a timeout, we do not abort the test,
  // because promises are not cancelable.

  if (timeout) {
    const test_promise = test_function();
    const timeout_promise = deferred_rejection(test_function, timeout);
    await Promise.race([test_promise, timeout_promise]);
  } else {
    await test_function();
  }

  console.log('%s: completed', test_function.name);
}

// TODO: timeout parameter should be instanceof Deadline
function deferred_rejection(test_function, time_ms) {
  const test_name = test_function.name.replace(/_/g, '-');
  const error = new Error('Test "' + test_name + '" timed out');
  return new Promise((_, reject) => setTimeout(reject, time_ms, error));
}

function find_test_by_name(name) {
  // Allow for either - or _ as separator and mixed case
  let normal_test_name = name.replace(/-/g, '_').toLowerCase();

  for (const test_function of registry) {
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
// TODO: use Deadline here
async function cli_run(name, timeout = 10000, parallel = true) {
  // Either run one test, run the named tests, or run all tests

  let tests;
  if (typeof name === 'string') {
    const test = find_test_by_name(name);
    if (!test) {
      console.warn('Test not found', name);
      return;
    }
    tests = [test];
  } else if (Array.isArray(name)) {
    tests = [];
    for (const n of name) {
      const test = find_test_by_name(n);
      if (test) {
        tests.push(test);
      } else {
        console.warn('Test not found', name);
      }
    }
  } else {
    tests = registry;
  }

  console.log('Spawning %d test(s)', tests.length);
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
  const duration_ms = end_time - start_time;
  console.log('%d tests completed in %d ms', tests.length, duration_ms);
}

function cli_print_tests() {
  register.map(test => test.name).forEach(console.log);
}

function populate_test_menu() {
  // TODO: sort the test list alphabetically by test name before render

  const menu = document.getElementById('tests');
  for (const test of registry) {
    const option = document.createElement('option');
    option.value = test.name;
    option.textContent = test.name.replace(/_/g, '-').toLowerCase();
    menu.appendChild(option);
  }
}
