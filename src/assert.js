// Assertions library

import sprintf from "/src/utils/sprintf.js";

// TODO: change assert to accept varargs instead of message once sprintf.js settles

// If true, any assertion errors are immediately logged. This helps avoid issues with promise-
// swallowed exceptions
const LOG_ERRORS = true;
// If true, assertion errors are thrown. If false, assertion errors are simply logged.
const ASSERTIONS_ENABLED = true;

function assert(condition, ...varargs) {
  if(!condition) {
    const formattedMessage = sprintf(...varargs);
    const error = new AssertionError(formattedMessage);
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
