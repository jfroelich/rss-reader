// Assertions library

// TODO: this function is so popular that I think it exceeds being a utility and is more like some
// form of a base library function. I think it belongs in the root folder.


// TODO: should I demand or warn when condition is not boolean? Something about using
// monomorphic functions. http://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html
// The idea is that I want to signal to v8 to inline. It would be interesting to learn more about
// how to better signal intent to the interpreter. On the otherhand, what does type restriction
// really buy? Less caller convenience. Mralpheph's article talks about objects but I wonder if
// the same idea applies to functions.

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
