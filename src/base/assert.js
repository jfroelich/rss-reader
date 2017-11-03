'use strict';

class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
    //Error.captureStackTrace(this, this.constructor.name);
  }
}

function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);
    // Always log in case the assertion is swallowed
    console.error(error);
    throw error;
  }
}
