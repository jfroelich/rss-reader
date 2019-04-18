import '/src/test/archive-resources-test.js';
import '/src/test/better-fetch-tests.js';
import '/src/test/coerce-element-test.js';
import '/src/test/color-contrast-filter-test.js';
import '/src/test/color-test.js';
import '/src/test/count-resources-test.js';
import '/src/test/create-resource-test.js';
import '/src/test/delete-resource-test.js';
import '/src/test/dom-filter-tests.js';
import '/src/test/export-opml-test.js';
import '/src/test/favicon-tests.js';
import '/src/test/feed-parser-test.js';
import '/src/test/fetch-html-test.js';
import '/src/test/fetch-image-element-test.js';
import '/src/test/filter-publisher-test.js';
import '/src/test/filter-unprintables-tests.js';
import '/src/test/get-path-extension-test.js';
import '/src/test/get-resource-test.js';
import '/src/test/get-resources-test.js';
import '/src/test/image-dimensions-filter-tests.js';
import '/src/test/import-entry-tests.js';
import '/src/test/import-opml-test.js';
import '/src/test/indexeddb-utils-test.js';
import '/src/test/migrations-tests.js';
import '/src/test/mime-utils-test.js';
import '/src/test/patch-resource-test.js';
import '/src/test/put-resource-test.js';
import '/src/test/remove-html-test.js';
import '/src/test/resource-utils-tests.js';
import '/src/test/set-base-uri-test.js';
import '/src/test/subscribe-test.js';
import '/src/test/truncate-html-tests.js';
import '/src/test/unwrap-element-tests.js';
import '/src/test/url-sniffer-test.js';
import TestRegistry from '/src/test/test-registry.js';

// Wrap a call to a test function with some extra log messages. Impose an optional deadline for the
// test to complete by specifying a timeout. The test will fail either immediately when creating the
// promise, or later when awaiting the promise when the test has rejected, or after the timeout
// occurred. We throw an error in all 3 cases. Note that in the timeout case we ignore the test
// result (pass or error) and throw a timeout error instead. Also note that in the case of a
// timeout, we do not abort the test, because promises are not cancelable.
async function runTimedTest(testFunction, timeout = 0) {
  console.log('%s: started', testFunction.name);
  if (timeout) {
    const testPromise = testFunction();
    const timeoutPromise = watchdogWatch(testFunction, timeout);
    await Promise.race([testPromise, timeoutPromise]);
  } else {
    await testFunction();
  }
  console.log('%s: completed', testFunction.name);
}

function watchdogWatch(testFunction, timeMs) {
  const error = new Error(`Test "${testFunction.name}" timed out`);
  return new Promise((_, reject) => setTimeout(reject, timeMs, error));
}

// Run one or more tests either all at once or one after the other. In either case, if any test
// fails, the function exits (but tests may still run indefinitely).
// @param name {String} optional, name of test to run, if not specified then all tests run
// @param timeout {Number} optional, ms, per-test timeout value
// @param parallel {Boolean} optional, whether to run tests in parallel or serial, defaults to
// false (serial)
async function cliRun(name, timeout = 10000, parallel = true) {
  // Either run one test, run the named tests, or run all tests

  let tests;
  if (typeof name === 'string') {
    const test = TestRegistry.findTestByName(name);
    if (!test) {
      console.warn('Test not found', name);
      return;
    }
    tests = [test];
  } else if (Array.isArray(name)) {
    tests = [];
    for (const n of name) {
      const test = TestRegistry.findTestByName(n);
      if (test) {
        tests.push(test);
      } else {
        console.warn('Test not found', name);
      }
    }
  } else {
    tests = TestRegistry.getTests();
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

function printTestsCommand() {
  TestRegistry.getTests().forEach((testFunction) => {
    console.log(testFunction.name);
  });
}

function handleTestAnchorClick(event) {
  event.stopPropagation();
  const anchor = event.target;
  const testName = anchor.getAttribute('test-name');
  const testFunction = TestRegistry.findTestByName(testName);

  if (!testFunction) {
    console.error('Could not find test function', testName);
    return false;
  }

  runTimedTest(testFunction).catch(console.error);
  return false;
}

// Compare two test functions for purposes of sorting. This is a simple lexicographic sort
function compareTests(a, b) {
  if (a.name === b.name) {
    return 0;
  }
  return a.name < b.name ? -1 : 1;
}

function populateTestListView() {
  // copy to avoid mutation (treat registry as immutable)
  const testFunctions = [...TestRegistry.getTests()];
  testFunctions.sort(compareTests);

  const testListElement = document.getElementById('tests');
  for (const testFunction of testFunctions) {
    const anchor = document.createElement('a');
    anchor.href = '#';
    anchor.setAttribute('test-name', testFunction.name);
    anchor.onclick = handleTestAnchorClick;
    anchor.append(testFunction.name);

    const listItemElement = document.createElement('li');
    listItemElement.append(anchor);
    testListElement.append(listItemElement);
  }
}

// On module load, expose console commands
window.run = cliRun;
window.printTests = printTestsCommand;

// On module load, populate the tests menu
populateTestListView();
