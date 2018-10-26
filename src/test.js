// TODO: review all tests and ensure that tests follow pathological paths in
// addition to the normal path. for example see the following url:
// https://www.usenix.org/system/files/login/articles/03_lu_010-017_final.pdf
// TODO: think of a nice way to ensure that each test uses a unique database to
// avoid any surprises when running tests concurrently. maybe use a prefix
// string parameter when calling each test function that is unique to that test
// function call
// TODO: consider enabling tests to somehow declare their own timeout instead of
// using the same timeout for all tests. actually, each test function should use
// a db named after the test itself. we know all test functions are unique?

import {article_title_test} from '/src/base/article-title-test.js';
import {coerce_element_test} from '/src/base/coerce-element-test.js';
import * as color_contrast_filter_tests from '/src/base/color-contrast-filter-test.js';
import {color_test} from '/src/base/color-test.js';
import * as favicon_cache_tests from '/src/base/favicon/cache-tests.js';
import {fetch_image_test} from '/src/base/fetch-image/fetch-image-test.js';
import {empty_attribute_filter_test} from '/src/base/filter-empty-attrs-test.js';
import {filter_lazy_images_test} from '/src/base/filter-lazy-images-test.js';
import {filter_unprintables_test} from '/src/base/filter-unprintables-test.js';
import {html_truncate_test} from '/src/base/html-truncate-test.js';
import * as image_size_filter_tests from '/src/base/image-size-filter/image-size-filter-test.js';
import * as indexeddb_tests from '/src/base/indexeddb-test.js';
import {mime_test} from '/src/base/mime-test.js';
import {parse_feed_test} from '/src/base/parse-feed-test.js';
import {replace_tags_test} from '/src/base/replace-tags-test.js';
import * as rewrite_url_tests from '/src/base/rewrite-url-test.js';
import {base_uri_test} from '/src/base/set-base-uri-test.js';
import {sniff_test} from '/src/base/sniff-test.js';
import {unwrap_element_test} from '/src/base/unwrap-element-test.js';
import {fetch_feed_test} from '/src/control/fetch-feed-test.js';
import {fetch_html_test} from '/src/control/fetch-html-test.js';
import {fetch2_test} from '/src/control/fetch2-test.js';
import {import_opml_test} from '/src/control/import-opml-test.js';
import {subscribe_test} from '/src/control/subscribe-test.js';
import * as db_tests from '/src/db/db-tests.js';

// A set-like array of test functions
const registry = [];

// Register tests
register_test(article_title_test);
register_test(base_uri_test);
register_test(color_contrast_filter_tests.color_contrast_filter_test1);
register_test(color_contrast_filter_tests.color_contrast_filter_test2);
register_test(color_test);
register_test(coerce_element_test);
register_test(db_tests.activate_feed_test);
register_test(db_tests.archive_entries_test);
register_test(db_tests.count_unread_entries_test);
register_test(db_tests.count_unread_entries_by_feed_test);
register_test(db_tests.create_entry_test);
register_test(db_tests.create_feed_test);
register_test(db_tests.create_feed_url_constraint_test);
register_test(db_tests.create_feeds_test);
register_test(db_tests.deactivate_feed_test);
register_test(db_tests.delete_entry_test);
register_test(db_tests.delete_feed_test);
register_test(db_tests.entry_utils_is_entry_test);
register_test(db_tests.entry_utils_append_entry_url_test);
register_test(db_tests.feed_utils_is_feed_test);
register_test(db_tests.feed_utils_append_feed_url_test);
register_test(db_tests.get_entries_test);
register_test(db_tests.get_entry_test);
register_test(db_tests.get_feed_test);
register_test(db_tests.get_feed_ids_test);
register_test(db_tests.get_feeds_test);
register_test(db_tests.iterate_entries_test);
register_test(db_tests.mark_entry_read_test);
register_test(db_tests.query_entries_test);
register_test(db_tests.remove_lost_entries_test);
register_test(db_tests.remove_orphaned_entries_test);
register_test(db_tests.remove_untyped_objects_test);
register_test(db_tests.sanitize_entry_content_test);
register_test(db_tests.update_entry_test);
register_test(db_tests.update_feed_test);
register_test(empty_attribute_filter_test);
register_test(favicon_cache_tests.favicon_cache_open_test);
register_test(favicon_cache_tests.favicon_cache_put_find_test);
register_test(favicon_cache_tests.favicon_cache_clear_test);
register_test(favicon_cache_tests.favicon_cache_compact_test);
register_test(fetch_feed_test);
register_test(fetch_html_test);
register_test(fetch_image_test);
register_test(fetch2_test);
register_test(filter_unprintables_test);
register_test(html_truncate_test);
register_test(favicon_service_test);
register_test(image_size_filter_tests.set_image_sizes_basic_test);
register_test(image_size_filter_tests.set_image_sizes_404_test);
register_test(image_size_filter_tests.set_image_sizes_text_only_test);
register_test(image_size_filter_tests.set_image_sizes_sourceless_test);
register_test(import_opml_test);
register_test(indexeddb_tests.indexeddb_test);
register_test(indexeddb_tests.indexeddb_function_object_test);
register_test(filter_lazy_images_test);
register_test(mime_test);
register_test(parse_feed_test);
register_test(replace_tags_test);
register_test(rewrite_url_tests.rewrite_url_norewrite_test);
register_test(rewrite_url_tests.rewrite_url_google_news_test);
register_test(rewrite_url_tests.rewrite_url_techcrunch_test);
register_test(rewrite_url_tests.rewrite_url_cyclical_test);
register_test(sniff_test);
register_test(subscribe_test);
register_test(unwrap_element_test);

function register_test(test_function) {
  if (typeof test_function !== 'function') {
    throw new TypeError('test_function is not a function: ' + test_function);
  }

  if (registry.includes(test_function)) {
    console.warn('%s: test already registered', test_function.name);
    return;
  }

  registry.push(test_function);
}

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
  const test_name = test_function.name.replace(/_/g, '-');
  const error = new Error('Test "' + test_name + '" timed out');
  return new Promise((_, reject) => setTimeout(reject, time_ms, error));
}

// Lookup a test function by the function's name
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
  const duration_ms = end_time - start_time;
  console.log('%d tests completed in %d ms', tests.length, duration_ms);
}

function cli_print_tests() {
  registry.forEach(test => console.log(test.name));
}

function populate_test_menu() {
  const menu = document.getElementById('tests');
  for (const test of registry) {
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
