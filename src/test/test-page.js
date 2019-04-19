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

// Call the given test function with some extra log messages and with an optional timeout. The test
// will fail either (1) immediately (in the same tick) when calling the test, or (2) later when
// awaiting the promise when the test has rejected prior to the test timing out, or (3) after the
// timeout occurred. We throw an error in all 3 cases. In the timeout case we ignore the test result
// and throw a timeout error. In the timeout case we do not abort the test because promises are not
// cancelable. In any error case there is no guarantee a test cleans up after itself.
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
// @param name {Any} optional, name of test to run, or an array of names of tests to run, or, if not
// specified then all tests run
// @param timeout {Number} optional, ms, per test timeout value
// @param parallel {Boolean} optional, defaults to true, if true then when running multiple tests
// the tests all run at the same time, if false then the each test waits for the previous test to
// complete before starting
async function cliRun(name, timeout = 10000, parallel = true) {
  let testFunctions = [];
  if (typeof name === 'string') {
    // run the one named test
    const testFunction = TestRegistry.findTestByName(name);
    if (!testFunction) {
      console.warn('Test not found', name);
      return;
    }
    testFunctions.push(testFunction);
  } else if (Array.isArray(name)) {
    // run the named tests in the array
    for (const testName of name) {
      const testFunction = TestRegistry.findTestByName(testName);
      if (testFunction) {
        testFunctions.push(testFunction);
      } else {
        console.warn('Test not found', name);
        // Continue
      }
    }
  } else {
    // run all tests
    testFunctions = TestRegistry.getTests();
  }

  console.log('Spawning %d test(s)', testFunctions.length);
  const startTime = new Date();

  if (parallel) {
    // Start all tests in order. Each consecutively started test does not wait until the previous
    // test has completed to start.
    const promises = [];
    for (const testFunction of testFunctions) {
      promises.push(runTimedTest(testFunction, timeout));
    }
    // Wait for all outstanding tests to complete.
    await Promise.all(promises);
  } else {
    // Start tests one a time, in order. Each consecutively started test waits until the prior test
    // completes before starting.
    for (const testFunction of testFunctions) {
      // eslint-disable-next-line no-await-in-loop
      await runTimedTest(testFunction, timeout);
    }
  }

  const endTime = new Date();
  const durationMs = endTime - startTime;
  console.log('%d tests completed in %d ms', testFunctions.length, durationMs);
}

function printTestsCommand() {
  TestRegistry.getTests().forEach((testFunction) => {
    console.log(testFunction.name);
  });
}

async function handleTestAnchorClick(event) {
  event.stopPropagation();
  const anchor = event.target;
  const testName = anchor.getAttribute('test-name');
  const testFunction = TestRegistry.findTestByName(testName);

  if (!testFunction) {
    console.error('Could not find test function', testName);
    return;
  }

  await runTimedTest(testFunction, 10000);
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
