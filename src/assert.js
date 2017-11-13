// Assertions library

// TODO: the assert function should be the default export

// If true, any assertion errors are immediately logged. This helps avoid issues with promise-
// swallowed exceptions
const LOG_ERRORS = true;

export function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);

    if(LOG_ERRORS) {
      console.error(error);
    }

    throw error;
  }
}

export class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}
