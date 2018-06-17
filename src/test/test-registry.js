// Provides a way to store a list of tests

// Store tests. Intended to be set-like
const test_registry = [];

// Add a new test to the registry. If no test exists then exits with a warning
// message.
export function register_test(test_function) {
  // Prevent registering duplicate tests (treat registery as a set)
  if (has_test(test_function)) {
    console.warn('%s: test already registered', test_function.name);
    return;
  }

  test_registry.push(test_function);
}

// Returns an array of registered tests
export function get_registry() {
  return test_registry;
}

// Return whether the function exists in the registry
export function has_test(test_function) {
  // TODO: review equality comparison using the function itself. The perf does
  // not really matter, the goal is just to have a clear understanding. I do
  // not think there is actually a need to compare by name string.

  for (const test of test_registry) {
    if (test.name === test_function.name) {
      return true;
    }
  }
  return false;
}
