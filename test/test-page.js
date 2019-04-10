import archive_resources_test from '/test/archive-resources-test.js';
import * as better_fetch_tests from '/test/better-fetch-tests.js';
import coerce_element_test from '/test/coerce-element-test.js';
import * as color_contrast_filter_tests from '/test/color-contrast-filter-test.js';
import {color_test} from '/test/color-test.js';
import count_resources_test from '/test/count-resources-test.js';
import create_resource_test from '/test/create-resource-test.js';
import delete_resource_test from '/test/delete-resource-test.js';
import * as dom_filter_tests from '/test/dom-filter-tests.js';
import export_opml_test from '/test/export-opml-test.js';
import * as favicon_tests from '/test/favicon-tests.js';
import {parse_feed_test} from '/test/feed-parser-test.js';
import {fetch_html_test} from '/test/fetch-html-test.js';
import {fetch_image_element_test} from '/test/fetch-image-element-test.js';
import {filter_publisher_test} from '/test/filter-publisher-test.js';
import * as filter_unprintables_tests from '/test/filter-unprintables-tests.js';
import get_path_extension_test from '/test/get-path-extension-test.js';
import get_resource_test from '/test/get-resource-test.js';
import get_resources_test from '/test/get-resources-test.js';
import * as image_size_filter_tests from '/test/image-dimensions-filter-tests.js';
import * as import_entry_tests from '/test/import-entry-tests.js';
import import_opml_test from '/test/import-opml-test.js';
import * as indexeddb_utils_tests from '/test/indexeddb-utils-test.js';
import * as migrations_tests from '/test/migrations-tests.js';
import {mime_test} from '/test/mime-utils-test.js';
import patch_resource_test from '/test/patch-resource-test.js';
import put_resource_test from '/test/put-resource-test.js';
import {remove_html_test} from '/test/remove-html-test.js';
import * as resource_utils_tests from '/test/resource-utils-tests.js';
import * as set_base_uri_tests from '/test/set-base-uri-tests.js';
import {subscribe_test} from '/test/subscribe-test.js';
import * as truncate_html_tests from '/test/truncate-html-tests.js';
import * as unwrap_element_tests from '/test/unwrap-element-tests.js';
import {url_sniffer_test} from '/test/url-sniffer-test.js';

const registry = [];

// db-resource ops tests
register_test(archive_resources_test);
register_test(count_resources_test);
register_test(create_resource_test);
register_test(delete_resource_test);
register_test(get_resource_test);
register_test(get_resources_test);
register_test(patch_resource_test);
register_test(put_resource_test);

// Other tests
register_test(coerce_element_test);
register_module_tests(color_contrast_filter_tests);
register_test(color_test);
register_module_tests(dom_filter_tests);
register_test(export_opml_test);
register_module_tests(favicon_tests);
register_test(fetch_html_test);
register_test(fetch_image_element_test);
register_test(filter_publisher_test);
register_test(get_path_extension_test);
register_module_tests(indexeddb_utils_tests);
register_module_tests(image_size_filter_tests);
register_module_tests(import_entry_tests);
register_test(import_opml_test);
register_module_tests(migrations_tests);
register_test(mime_test);
register_module_tests(better_fetch_tests);
register_test(parse_feed_test);
register_test(remove_html_test);
register_module_tests(resource_utils_tests);
register_module_tests(set_base_uri_tests);
register_test(url_sniffer_test);
register_module_tests(filter_unprintables_tests);
register_test(subscribe_test);
register_module_tests(truncate_html_tests);
register_module_tests(unwrap_element_tests);

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

function handle_test_anchor_click(event) {
  event.stopPropagation();
  const anchor = event.target;
  const test_name = anchor.getAttribute('test-name');
  const test_function = find_test_by_name(test_name);
  run_timed_test(test_function).catch(console.error);
  return false;
}

function populate_test_menu() {
  registry.sort();

  const test_list = document.getElementById('tests');
  for (const test of registry) {
    const anchor = document.createElement('a');
    anchor.href = '#';
    anchor.setAttribute('test-name', test.name);
    anchor.onclick = handle_test_anchor_click;
    anchor.append(test.name.replace(/_/g, '-').toLowerCase());

    const list_item = document.createElement('li');
    list_item.append(anchor);
    test_list.append(list_item);
  }
}
