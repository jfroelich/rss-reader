// Assertions library

import sprintf from "/src/utils/sprintf.js";

// If true, any assertion errors are immediately logged. This helps avoid issues with promise-
// swallowed exceptions. This is tested against every time function is called.
const LOG_ERRORS = true;
// If true, assertion errors are thrown. If false, assertion errors are simply logged. This is
// testeds against when this module is loaded.
const ASSERTIONS_ENABLED = true;

function assert(condition, ...varargs) {

  // TODO: once it seems like sprintf is always working, only call if !condition. But for now,
  // always call, so that any error situation shows up really clearly. This will degrade the
  // performance of pretty much every single function in the entire app, but I want to find any
  // errors.
  const formattedMessage = sprintf(...varargs);

  if(!condition) {

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
