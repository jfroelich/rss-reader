// TODO: currently doesn't work, feeds are not loaded, I basically need to do
// something like include all test modules here, so that each one registers
// itself as a side effect of import. But tests depend on this file, so
// circular, so first I need to fix that, maybe by moving test helpers to a
// separate file


// TODO: the basic idea is that I can have any number of separate tests
// Each test file should import this file
// Each test file should register its tests using register_test
// A test file can register more than one test
// All tests are run async
// Every test should be an async function, even if it is sync



// TODO: what does it mean to fail? not return true? throw an error?
// I think it will be better with errors because that means the test code
// doesn't need to concern itself with trapping everything. Also, I could define
// an assert helper and use it throughout the tests

// TODO: the problem with local assert helper is that it masks source of error a
// tiny bit, at least makes it less straightforward, have to look at stack each
// time, because now all errors look like they emanate from here

// TODO: issue, what about tests that create the same db, I will have to make
// extra sure every test uses unique stuff
// TODO: all tests will need to be rewritten to use this approach
// TODO: how do I log errors per test or whatever
// TODO: should I not fail all if any one test fails (due to Promise.all
// behavior)
// TODO: maybe I should run serially? For tests that log errors the log will
// get all mixed up. What about resource constraints?
// TODO: should tests register with a name?

const tests = [];

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Test assertion error');
  }
}

export function register_test(test_function) {
  tests.push(test_function);
}

async function main() {
  console.debug('Running all tests');

  const test_promises = [];
  for (const test of tests) {
    console.log('Running test', test.name);
    test_promises.push(test());
  }

  const results = await Promise.all(test_promises);
  console.debug('Completed all tests');
}

window.main = main;
