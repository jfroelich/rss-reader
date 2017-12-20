import sprintf from "/src/utils/sprintf.js";

// Throws an assertion error when the condition value is false or false-like
// @param booleanValue {Any} any value, usually the result of some expression, preferably boolean
// @varargs any number of any type of additional arguments that are forwarded to a call to
// sprintf that formats the arguments into a string that becomes the message value of the
// assertion error that is thrown. If no additional arguments are given then a default error
// message is used.
export default function assert(booleanValue, ...varargs) {

  // TEMP: Weakly check the parameter type. I prefer callers use a proper boolean. Warn using
  // console.error so that the stack trace is captured.
  if(typeof booleanValue !== 'boolean') {
    console.error('not boolean', booleanValue);
  }

  if(booleanValue) {
    return;
  }

  const errorMessage = sprintf(...varargs) || 'Assertion failed';
  const error = new AssertionError(errorMessage);

  // If not commented out, any assertion errors are immediately logged. Enabling this option helps
  // avoid issues with promise swallowed exceptions. While the browser generally logs an error
  // message for uncaught exceptions in promise executors, it doesn't help when the error is caught
  // in a catch block but not logged or rethrown. I'd rather not require every use of a catch block
  // be concerned with handling unchecked errors.
  console.error(errorMessage);

  throw error;
}

// An assertion error indicates something went really wrong in an unexpected way. For example,
// a variable was of the wrong type, or a variable was in an unexpected state. Assertion errors
// indicate that something that should never happen ... happened. It primarily indicates that
// the reasoning used somewhere in the collective program is incorrect, that a faulty assumption
// was made somewhere about the state of things.

// Generally no other module should import or explicitly throw an AssertionError. Instead, that
// module should call assert with a value that then throws an assertion error as a side effect
// when the value is false. Ideally this error would not be exported. However, a few other
// modules need to directly access the class itself such as when testing whether an error is a type
// of an assertion error.

export class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}
