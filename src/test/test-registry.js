// A set-like array of test functions
const tests = [];

export function register_test(test_function) {
  if (typeof test_function !== 'function') {
    throw new TypeError('test_function is not a function');
  }

  if (tests.includes(test_function)) {
    console.warn('%s: test already registered', test_function.name);
    return;
  }

  tests.push(test_function);
}

// Returns an array of registered tests
export function get_registry() {
  return tests;
}
