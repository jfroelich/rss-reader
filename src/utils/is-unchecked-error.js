import {AssertionError} from "/src/common/assert.js";

// TODO: this module is too simple. What I should have is a utilities module like 'error-utils.js',
// and this should just be one method of that module.

// TODO: i should possibly separate this from assertion error and just have a function like
// isNativeError that returns true if an error is an instance of one of the known native errors.
// The tradeoff would be the caller who cares about the class of checked vs unchecked then
// needs to check for isNativeError(error) || isAssertionError(error) instead of just this call.
// The thing is that this is so tightly coupled to assert, that it is basically never re-usable.

// TODO: what if I create an error subclass, CheckedError. Change all custom app errors to extend from
// CheckedError except for AssertionError. Then change isUncheckedError's logic. Instead of checking
// an enumerated set of known unchecked errors, this instead does a single test against whether the
// error is an instance of a checked error, and returns false in that case. Then all non-enumerated
// errors are considered unchecked. This alleviates the need to manage or be aware of which errors
// are checked or unchecked, and uses fewer conditions, and is probably simpler to maintain. It
// also decouples assertion error from this function. Now the decision takes place when the
// error class is defined based on whether it subclasses CheckedError. And the caller just needs
// to use 'error instanceof CheckedError' instead of a function call in an external module.

// A helper for use in catch blocks that want to re-throw unexpected errors that should not be
// caught.
export default function isUncheckedError(error) {
  return error instanceof AssertionError ||
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError ||
    error instanceof SyntaxError ||
    error instanceof URIError ||
    error instanceof EvalError;
}
