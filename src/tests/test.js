import {archive_entries_test} from '/src/tests/archive-entries-test.js';
import {boilerplate_test} from '/src/tests/boilerplate-test.js';
import {color_contrast_filter_test1, color_contrast_filter_test2} from '/src/tests/color-contrast-filter-test.js';
import {color_test} from '/src/tests/color-test.js';
import {create_channel_test1, create_channel_test2} from '/src/tests/create-channel-test.js';
import {create_feed_test} from '/src/tests/create-feed-test.js';
import {element_coerce_test} from '/src/tests/element-coerce-test.js';
import {empty_attribute_filter_test} from '/src/tests/empty-attribute-filter-test.js';
import {favicon_service_test} from '/src/tests/favicon-service-test.js';
import {feed_parser_test} from '/src/tests/feed-parser-test.js';
import {fetch_feed_test} from '/src/tests/fetch-feed-test.js';
import {fetch_html_test} from '/src/tests/fetch-html-test.js';
import {filter_publisher_test} from '/src/tests/filter-publisher-test.js';
import {filter_unprintable_characters_test} from '/src/tests/filter-unprintable-characters-test.js';
import {html_truncate_test} from '/src/tests/html-truncate-test.js';
import {idb_test} from '/src/tests/idb-test.js';
import {import_opml_test} from '/src/tests/import-opml-test.js';
import {mime_test} from '/src/tests/mime-test.js';
import {rewrite_url_test} from '/src/tests/rewrite-url-test.js';
import {sniff_test} from '/src/tests/sniff-test.js';
import {subscribe_test} from '/src/tests/subscribe-test.js';
import {url_loader_test} from '/src/tests/url-loader-test.js';

// Tests must be promise returning functions

// TODO: all tests should more carefully test error paths. That is where the
// greatest number of bugs tends to occur. See, e.g.,
// https://www.usenix.org/system/files/login/articles/03_lu_010-017_final.pdf
// TODO: many of the tests are logging things that they are not testing, I
// should silence those messages for those tests. For example most of the tests
// are logging opening and creating a test database but those tests are not
// testing the creation of a database so that aspect should be muted
// TODO: note the horrible requirement of requiring a unique database. Maybe to
// coordinate, if I want to continue async, is that each test's first parameter
// is a test database name. Then I can simply do things like use test0, test1,
// etc, and the counter guarantees each db name is unique. On the other hand, I
// could run tests serially.
// TODO: each test could take a custom console parameter, then i could do things
// like implement a bufferedlogger, then queue messages per logger (per test),
// then flush on test complete together with using console.group and groupEnd,
// to get a cleaner console when running tests in parallel. Alternatively I
// could use an html-based logger that appends log messages to the test view so
// that there is no need to even open the console area and instead just view the
// page to run tests
// TODO: maybe enable tests to declare their own custom timeout
// TODO: re-introduce a register-test function instead of hardcoding the
// array. Managing the array is tedious. Performance is irrelevant, ergonomics
// trumps.


// The test registry is basically the set of all tests. For simplicity it is
// implemented as an array, but it should be treated as a set.
// clang-format off
const test_registry = [
  archive_entries_test,
  boilerplate_test,
  color_contrast_filter_test1,
  color_contrast_filter_test2,
  color_test,
  create_channel_test1,
  create_channel_test2,
  create_feed_test,
  element_coerce_test,
  empty_attribute_filter_test,
  favicon_service_test,
  feed_parser_test,
  fetch_feed_test,
  fetch_html_test,
  filter_publisher_test,
  filter_unprintable_characters_test,
  html_truncate_test,
  idb_test,
  import_opml_test,
  mime_test,
  rewrite_url_test,
  sniff_test,
  subscribe_test,
  url_loader_test
];
// clang-format on

// Wrap the call to a test function with some extra log messages
// Timeout the test if a timeout is specified
async function run_timed_test(test_function, timeout = 0) {
  console.log('%s: started', test_function.name);

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
  return new Promise((resolve, reject) => {
    setTimeout(reject, time_ms, error);
  });
}

// Lookup a test function by the function's name
function find_test_by_name(test_name) {
  // Allow for either - or _ as separator
  // Allow for non-normal case
  let normal_test_name = test_name.replace(/-/g, '_').toLowerCase();

  for (const test_function of test_registry) {
    if (test_function.name === normal_test_name) {
      return test_function;
    }
  }
}

// name - optional, string, name of test to run, if not specified all tests run
// timeout - optional, ms, per-test timeout value
// parallel - optional, boolean, whether to run tests in parallel or serial
async function cli_run(name, timeout = 10000, parallel) {
  if (!['undefined', 'string'].includes(typeof name)) {
    throw new TypeError('Invalid name parameter ' + name);
  }

  // Either create an array of one test, or get all tests in the registry
  let tests;
  if (name) {
    const test = find_test_by_name(name);
    if (!test) {
      console.warn('%s: test not found', cli_run.name, name);
      return;
    }
    tests = [test];
  } else {
    tests = test_registry;
  }

  console.log('%s: spawning %d tests', cli_run.name, tests.length);

  const start_time = new Date();

  if (parallel && tests.length > 1) {
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

  console.log('%s: completed in %d ms', cli_run.name, end_time - start_time);
}

function cli_print_tests() {
  test_registry.forEach(test => console.log(test.name));
}

// Expose console commands
window.run = cli_run;
window.print_tests = cli_print_tests;

// On document load, populate the tests menu
const test_select = document.getElementById('tests');
for (const test of test_registry) {
  const test_name = test.name.replace(/_/g, '-');
  const option = document.createElement('option');
  option.value = test_name;
  option.textContent = test_name;
  test_select.appendChild(option);
}
