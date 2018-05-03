import {archive_entries_test} from '/src/tests/archive-entries-test.js';
import {boilerplate_test} from '/src/tests/boilerplate-test.js';
import {color_contrast_filter_test1, color_contrast_filter_test2} from '/src/tests/color-contrast-filter-test.js';
import {color_test} from '/src/tests/color-test.js';
import {create_channel_test1, create_channel_test2} from '/src/tests/create-channel-test.js';
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
import {mime_test} from '/src/tests/mime-test.js';
import {rewrite_url_test} from '/src/tests/rewrite-url-test.js';
import {sniff_test} from '/src/tests/sniff-test.js';
import {subscribe_test} from '/src/tests/subscribe-test.js';
import {url_loader_test} from '/src/tests/url-loader-test.js';
import {write_new_feed_test} from '/src/tests/write-new-feed-test.js';

// Tests must be promise returning functions

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
  mime_test,
  rewrite_url_test,
  sniff_test,
  subscribe_test,
  url_loader_test,
  write_new_feed_test
];
// clang-format on

// Wrap the call to a test function with some extra log messages
async function run_test_function(test_function, timeout = 0) {
  console.log('%s: started', test_function.name);
  // await test_function();
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

// Run a particular test, based on its name
async function run_one(test_function_name) {
  const test_function = find_test_by_name(test_function_name);
  if (typeof test_function !== 'function') {
    console.warn('Test not found:', test_function_name);
    return;
  }

  await run_test_function(test_function);
}

async function run_parallel() {
  let timeout = 10000;
  console.log('Running all tests in parallel');
  const test_promises = [];
  for (const test of test_registry) {
    test_promises.push(run_test_function(test, timeout));
  }

  await Promise.all(test_promises);
  console.log('Completed all tests');
}

async function run_serial() {
  let timeout = 5000;
  let counter = 0;
  let total = test_registry.length;
  console.log('Running all tests serially');
  for (const test of test_registry) {
    await run_test_function(test, timeout);
    counter++;
    console.debug('finished %d of %d', counter, total);
  }

  console.log('Completed all tests');
}

function print_tests() {
  console.group('Test names');
  const names = test_registry.map(test => test.name);
  names.forEach(name => console.log(name));
  console.groupEnd();
}

// Expose console commands
window.run_parallel = run_parallel;
window.run_serial = run_serial;
window.run_one = run_one;
window.print_tests = print_tests;


// On document load, populate the tests menu
const test_select = document.getElementById('tests');
for (const test of test_registry) {
  const test_display_name = test.name.replace(/_/g, '-');
  const test_option = document.createElement('option');
  test_option.value = test_display_name;
  test_option.textContent = test_display_name;
  test_select.appendChild(test_option);
}
