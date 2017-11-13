
const LOG_ERRORS = true;

// @throws {AssertionError}
export function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);

    if(LOG_ERRORS) {
      console.error(error);
    }

    throw error;
  }
}

class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}
