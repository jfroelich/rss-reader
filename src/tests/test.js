import {archive_entries_test} from '/src/tests/archive-entries-test.js';
import {boilerplate_test} from '/src/tests/boilerplate-test.js';
import {color_contrast_filter_test1, color_contrast_filter_test2} from '/src/tests/color-contrast-filter-test.js';
import {color_test} from '/src/tests/color-test.js';
import {create_channel_test1, create_channel_test2} from '/src/tests/create-channel-test.js';
import {element_coerce_test} from '/src/tests/element-coerce-test.js';
import {idb_test} from '/src/tests/idb-test.js';
import {mime_test} from '/src/tests/mime-test.js';
import {rewrite_url_test} from '/src/tests/rewrite-url-test.js';
import {sniff_test} from '/src/tests/sniff-test.js';
import {subscribe_test} from '/src/tests/subscribe-test.js';
import {url_loader_test} from '/src/tests/url-loader-test.js';

async function run_test_function(test_function) {
  console.debug('%s: started', test_function.name);
  await test_function();
  console.debug('%s: completed', test_function.name);
}

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
  idb_test,
  mime_test,
  rewrite_url_test,
  sniff_test,
  subscribe_test,
  url_loader_test
];
// clang-format on

const test_promises = [];
for (const test of test_registry) {
  console.log('Starting test', test.name);
  test_promises.push(run_test_function(test));
}

const all_promise = Promise.all(test_promises);
all_promise.then(_ => {
  console.debug('Completed all tests');
});
all_promise.catch(error => console.error);
