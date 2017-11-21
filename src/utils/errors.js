// Misc errors and error-related utilities

import {AssertionError} from "/src/assert.js";
import sprintf from "/src/utils/sprintf.js";

const LOG_CHECKED_ERRORS = false;

// This function works similar to assert, but throws a checked error as opposed to an assertion
// error. assert is intended to be used only for "this should never happen situations" that
// represent static programming errors based on very faulty assumptions. Checked errors represent
// errors that happen in expected, typical situations, such as receiving bad input.
export function check(condition, errorConstructor, ...varargs) {
  if(condition) {
    return;
  }

  errorConstructor = errorConstructor || Error;

  const message = sprintf(...varargs) || 'Unknown error';

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

// TODO: rename to ParseError
export class ParseError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message || 'Operation timed out');
  }
}

export class PermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
