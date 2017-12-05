import sprintf from "/src/string/sprintf.js";

// If true, any assertion errors are immediately logged. This helps avoid issues with promise-
// swallowed exceptions. This is tested against every time function is called.
const LOG_ERRORS = true;
// If true, assertion errors are thrown. If false, assertion errors are simply logged. This is
// testeds against when this module is loaded.
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
