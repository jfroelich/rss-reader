import {AssertionError} from "/src/utils/assert.js";

// TODO: what if I create an error subclass, CheckedError. Change all errors to extend from
// CheckedError except for AssertionError. Then change isUncheckedError's logic. Instead of checking
// an enumerated set of known unchecked errors, this instead does a single test against whether the
// error is an instance of a checked error, and returns false in that case. Then all non-enumerated
// errors are considered unchecked. This alleviates the need to manage or be aware of which errors
// are checked or unchecked, and uses fewer conditions, and is probably simpler to maintain.

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
