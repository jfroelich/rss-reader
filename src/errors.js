// Misc errors and error-related utilities

import {AssertionError} from "/src/assert.js";

const LOG_CHECKED_ERRORS = false;

// This function works similar to assert, but throws a checked error as opposed to an assertion
// error. assert is intended to be used only for "this should never happen situations" that
// represent static programming errors based on very faulty assumptions. Checked errors represent
// errors that happen in expected, typical situations, such as receiving bad input.
// TODO: message should be varargs, like ...message, but to do that I need to first implement some
// kind of printf function that simulates how console log functions accept parameters
export function check(condition, errorConstructor, message) {
  if(condition) {
    return;
  }

  errorConstructor = errorConstructor || Error;
  message = message || 'Unknown error';

  const error = new errorConstructor(message);

  if(LOG_CHECKED_ERRORS) {
    console.error(error);
  }

  throw error;
}

// A helper for use in catch blocks that want to re-throw unexpected errors that should not be
// caught.
export function isUncheckedError(error) {
  return error instanceof AssertionError ||
    error instanceof TypeError ||
    error instanceof ReferenceError;
}

// TODO: is there a builtin ParseError object or similar? If so deprecate this and use that
export class ParserError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}

export class PermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
