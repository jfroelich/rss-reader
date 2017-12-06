import sprintf from "/src/string/sprintf.js";

// If true, any assertion errors are immediately logged. This helps avoid issues with promise
// swallowed exceptions. This is tested against every time the assert function is called.
// Currently this is true in development to really emphasize unexpected errors and make an earnest
// attempt at avoiding any hidden errors.
const LOG_ERRORS = true;

// Throws an assertion error when the condition value is false-like
// @param condition {Any} any value, usually the result of some expression
// @rest any number of any type of additional arguments that are forwarded to a call to
// sprintf that formats the arguments into a string that becomes the message value of the
// assertion error that is thrown. If no additional arguments are given then a default error
// message is used.
export default function assert(condition, ...varargs) {
  if(!condition) {
    const formattedMessage = sprintf(...varargs);
    const error = new AssertionError(formattedMessage);
    if(LOG_ERRORS) {
      console.error(error);
    }
    throw error;
  }
}

// An assertion error indicates something went really wrong in an unexpected way. For example,
// a variable was of the wrong type, or a variable was in an unexpected state. Assertion errors
// indicate that something that should never happen ... happened. It primarily indicates that
// the reasoning used somewhere in the collective program is incorrect, that a faulty assumption
// was made somewhere about the state of things.

// Generally no other module should import or explicitly throw an AssertionError. Instead, that
// module should call assert with a value that then throws an assertion error as a side effect
// when the value is falsy. Ideally this error would not be exported. However, a few other
// modules need to directly access the class itself such as when testing whether an error is a type
// of an assertion error.

export class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}
