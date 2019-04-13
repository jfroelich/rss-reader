import archiveResourcesTest from '/test/archive-resources-test.js';
import * as betterFetchTests from '/test/better-fetch-tests.js';
import coerceElementTest from '/test/coerce-element-test.js';
import * as colorContrastFilterTests from '/test/color-contrast-filter-test.js';
import colorTest from '/test/color-test.js';
import countResourcesTest from '/test/count-resources-test.js';
import createResourceTest from '/test/create-resource-test.js';
import deleteResourceTest from '/test/delete-resource-test.js';
import * as domFilterTests from '/test/dom-filter-tests.js';
import exportOPMLTest from '/test/export-opml-test.js';
import * as faviconTests from '/test/favicon-tests.js';
import parseFeedTest from '/test/feed-parser-test.js';
import fetchHTMLTest from '/test/fetch-html-test.js';
import fetchImageElementTest from '/test/fetch-image-element-test.js';
import filterPublisherTest from '/test/filter-publisher-test.js';
import filterUnprintablesTest from '/test/filter-unprintables-tests.js';
import getPathExtensionTest from '/test/get-path-extension-test.js';
import getResourceTest from '/test/get-resource-test.js';
import getResourcesTest from '/test/get-resources-test.js';
import * as imageSizeFilterTests from '/test/image-dimensions-filter-tests.js';
import importEntryTests from '/test/import-entry-tests.js';
import importOPMLTest from '/test/import-opml-test.js';
import * as indexedDBUtilsTests from '/test/indexeddb-utils-test.js';
import * as migrationsTests from '/test/migrations-tests.js';
import mimeUtilsTest from '/test/mime-utils-test.js';
import patchResourceTest from '/test/patch-resource-test.js';
import putResourceTest from '/test/put-resource-test.js';
import removeHTMLTest from '/test/remove-html-test.js';
import * as resourceUtilsTests from '/test/resource-utils-tests.js';
import setBaseURITest from '/test/set-base-uri-test.js';
import subscribeTest from '/test/subscribe-test.js';
import * as truncateHTMLTests from '/test/truncate-html-tests.js';
import * as unwrapElemenTests from '/test/unwrap-element-tests.js';
import urlSnifferTest from '/test/url-sniffer-test.js';

const registry = [];

// db-resource ops tests
registerTest(archiveResourcesTest);
registerTest(countResourcesTest);
registerTest(createResourceTest);
registerTest(deleteResourceTest);
registerTest(getResourceTest);
registerTest(getResourcesTest);
registerTest(patchResourceTest);
registerTest(putResourceTest);

// Other tests
registerTest(coerceElementTest);
registerModuleTests(colorContrastFilterTests);
registerTest(colorTest);
registerModuleTests(domFilterTests);
registerTest(exportOPMLTest);
registerModuleTests(faviconTests);
registerTest(fetchHTMLTest);
registerTest(fetchImageElementTest);
registerTest(filterPublisherTest);
registerTest(getPathExtensionTest);
registerModuleTests(indexedDBUtilsTests);
registerModuleTests(imageSizeFilterTests);
registerTest(importEntryTests);
registerTest(importOPMLTest);
registerModuleTests(migrationsTests);
registerTest(mimeUtilsTest);
registerModuleTests(betterFetchTests);
registerTest(parseFeedTest);
registerTest(removeHTMLTest);
registerModuleTests(resourceUtilsTests);
registerModuleTests(setBaseURITest);
registerTest(urlSnifferTest);
registerModuleTests(filterUnprintablesTest);
registerTest(subscribeTest);
registerModuleTests(truncateHTMLTests);
registerModuleTests(unwrapElemenTests);

// On module load, expose console commands
window.run = cliRun;
window.printTests = cliPrintTests;

// On module load, populate the tests menu
populateTestListView();

function registerModuleTests(mod) {
  for (const id in mod) {
    // obj.prop notation does not work here
    // TODO: switch to endsWith as a stricter condition?
    if (typeof mod[id] === 'function' && id.includes('_test')) {
      registerTest(mod[id]);
    }
  }
}

function registerTest(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError(`fn is not a function: ${fn}`);
  }

  if (registry.includes(fn)) {
    console.warn('Ignoring duplicate test registration:', fn.name);
    return;
  }

  registry.push(fn);
}

// Wrap a call to a test function with some extra log messages. Impose an
// optional deadline for the test to complete by specifying a timeout.
async function runTimedTest(testFunction, timeout = 0) {
  console.log('%s: started', testFunction.name);

  // The test will fail either immediately when creating the promise, or later
  // when awaiting the promise when the test has rejected, or after the timeout
  // occurred. We throw an error in all 3 cases. Note that in the timeout case
  // we ignore the test result (pass or error) and throw a timeout error
  // instead. Also note that in the case of a timeout, we do not abort the test,
  // because promises are not cancelable.

  if (timeout) {
    const testPromise = testFunction();
    const timeoutPromise = deferredRejectionPromise(testFunction, timeout);
    await Promise.race([testPromise, timeoutPromise]);
  } else {
    await testFunction();
  }

  console.log('%s: completed', testFunction.name);
}

// TODO: timeout parameter should be instanceof Deadline
function deferredRejectionPromise(testFunction, timeMs) {
  const testName = testFunction.name.replace(/_/g, '-');
  const error = new Error(`Test "${testName}" timed out`);
  return new Promise((_, reject) => setTimeout(reject, timeMs, error));
}

function findTestByName(name) {
  // Allow for either - or _ as separator and mixed case
  const normalTestName = name.replace(/-/g, '_').toLowerCase();

  for (const testFunction of registry) {
    if (testFunction.name === normalTestName) {
      return testFunction;
    }
  }

  return undefined;
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
async function cliRun(name, timeout = 10000, parallel = true) {
  // Either run one test, run the named tests, or run all tests

  let tests;
  if (typeof name === 'string') {
    const test = findTestByName(name);
    if (!test) {
      console.warn('Test not found', name);
      return;
    }
    tests = [test];
  } else if (Array.isArray(name)) {
    tests = [];
    for (const n of name) {
      const test = findTestByName(n);
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
  const startTime = new Date();

  if (parallel) {
    const promises = [];
    for (const test of tests) {
      promises.push(runTimedTest(test, timeout));
    }
    await Promise.all(promises);
  } else {
    for (const test of tests) {
      // eslint-disable-next-line no-await-in-loop
      await runTimedTest(test, timeout);
    }
  }

  const endTime = new Date();
  const durationMs = endTime - startTime;
  console.log('%d tests completed in %d ms', tests.length, durationMs);
}

function cliPrintTests() {
  registry.map(test => test.name).forEach(console.log);
}

function handleTestAnchorClick(event) {
  event.stopPropagation();
  const anchor = event.target;
  const testName = anchor.getAttribute('test-name');
  const testFunction = findTestByName(testName);
  runTimedTest(testFunction).catch(console.error);
  return false;
}

function populateTestListView() {
  registry.sort();

  const testListElement = document.getElementById('tests');
  for (const test of registry) {
    const anchor = document.createElement('a');
    anchor.href = '#';
    anchor.setAttribute('test-name', test.name);
    anchor.onclick = handleTestAnchorClick;
    anchor.append(test.name.replace(/_/g, '-').toLowerCase());

    const listItemElement = document.createElement('li');
    listItemElement.append(anchor);
    testListElement.append(listItemElement);
  }
}
