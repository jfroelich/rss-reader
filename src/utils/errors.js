import {AssertionError} from "/src/assert/assert.js";

// Misc errors and error-related utilities

// A helper for use in catch blocks that want to re-throw unexpected errors that should not be
// caught.
export function isUncheckedError(error) {
  return error instanceof AssertionError ||
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof RangeError ||
    error instanceof SyntaxError ||
    error instanceof URIError ||
    error instanceof EvalError;
}
