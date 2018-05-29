import '/src/tests/test-loader.js';
import {get_registry} from '/src/tests/test-registry.js';

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
function find_test_by_name(name) {
  // Allow for either - or _ as separator and mixed case
  let normal_test_name = name.replace(/-/g, '_').toLowerCase();

  const test_registry = get_registry();
  for (const test_function of test_registry) {
    if (test_function.name === normal_test_name) {
      return test_function;
    }
  }
}

// Run one or more tests
//
// @param name {String} optional, name of test to run, if not specified all
// tests run
// @param timeout {Number} optional, ms, per-test timeout value
// @param parallel {Boolean} optional, whether to run tests in parallel or
// serial, defaults to false
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
    tests = get_registry();
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
  const test_registry = get_registry();
  test_registry.forEach(test => console.log(test.name));
}

function populate_test_menu() {
  const test_registry = get_registry();
  const test_select = document.getElementById('tests');
  for (const test of test_registry) {
    const option = document.createElement('option');
    option.value = test.name;

    const display_name = test.name.replace(/_/g, '-').toLowerCase();
    option.textContent = display_name;
    test_select.appendChild(option);
  }
}

// On module load, expose console commands
window.run = cli_run;
window.print_tests = cli_print_tests;

// On module load, populate the tests menu
populate_test_menu();
