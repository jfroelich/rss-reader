import * as array_utils_tests from '/src/array-utils/array-utils-tests.js';
import {color_test} from '/src/color/color-test.js';
import {coerce_element_test} from '/src/dom-filters/coerce-element-test.js';
import * as color_contrast_filter_tests from '/src/dom-filters/color-contrast-filter-test.js';
import * as dom_filter_tests from '/src/dom-filters/dom-filter-tests.js';
import {fetch_image_element_test} from '/src/dom-filters/fetch-image-element-test.js';
import {legible_text_filter_test} from '/src/dom-filters/legible-text-filter-test.js';
import * as favicon_tests from '/src/favicon/favicon-tests.js';
import {fetch_image_test} from '/src/favicon/fetch-image-test.js';
import * as html_utils_tests from '/src/html-utils/html-utils-tests.js';
import * as image_size_filter_tests from '/src/dom-filters/image-dimensions-filter-tests.js';
import * as idb_tests from '/src/indexeddb-utils/indexeddb-utils-test.js';
import {mime_test} from '/src/mime/mime-test.js';
import * as entry_tests from '/src/model/entry-tests.js';
import * as feed_tests from '/src/model/feed-tests.js';
import * as model_tests from '/src/model/model-tests.js';
import * as net_tests from '/src/net/net-tests.js';
import {activate_feed_test} from '/src/ops/activate-feed-test.js';
import {deactivate_feed_test} from '/src/ops/deactivate-feed-test.js';
import {fetch_html_test} from '/src/ops/import-entry/fetch-html-test.js';
import {parse_feed_test} from '/src/ops/import-feed/feed-parser-test.js';
import {import_opml_test} from '/src/ops/import-opml/import-opml-test.js';
import {susbcribe_test} from '/src/ops/subscribe-test.js';
import * as rewrite_url_tests from '/src/config/rewrite-rules-tests.js';
import * as set_base_uri_tests from '/set/ops/import-entry/set-base-uri-tests.js';
import {filter_publisher_test} from '/src/slideshow-page/filter-publisher-test.js';
import {sniffer_test} from '/src/ops/import-entry/sniffer-test.js';
import * as string_utils_tests from '/src/model/filter-unprintables-tests.js';
import * as unwrap_element_tests from '/src/dom-filters/unwrap-element-tests.js';
import * as url_utils_tests from '/src/url-utils/url-utils-tests.js';

const registry = [];
register_test(activate_feed_test);
register_module_tests(array_utils_tests);
register_test(coerce_element_test);
register_module_tests(color_contrast_filter_tests);
register_test(color_test);
register_module_tests(set_base_uri_tests);
register_test(deactivate_feed_test);
register_module_tests(dom_filter_tests);
register_module_tests(entry_tests);
register_module_tests(favicon_tests);
register_module_tests(feed_tests);
register_test(fetch_html_test);
register_test(fetch_image_test);
register_test(fetch_image_element_test);
register_test(filter_publisher_test);
register_module_tests(html_utils_tests);
register_module_tests(idb_tests);
register_module_tests(image_size_filter_tests);
register_test(import_opml_test);
register_test(legible_text_filter_test);
register_test(mime_test);
register_module_tests(model_tests);
register_module_tests(net_tests);
register_test(parse_feed_test);
register_module_tests(rewrite_url_tests);
register_test(sniffer_test);
register_module_tests(string_utils_tests);
register_test(subscribe_test);
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
