// Assertions library

// If true, any assertion errors are immediately logged. This helps avoid issues with promise-
// swallowed exceptions
const LOG_ERRORS = true;
// If true, assertion errors are thrown. If false, assertion errors are simply logged.
const ASSERTIONS_ENABLED = true;

function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);
    if(LOG_ERRORS) {
      console.error(error);
    }
    throw error;
  }
}

export default ASSERTIONS_ENABLED ? assert : console.assert;

export class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}
