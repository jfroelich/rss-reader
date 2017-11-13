// Misc errors and error-related utilities

import {AssertionError} from "/src/assert.js";

// A helper for use in catch blocks that want to re-throw unexpected errors that should not be
// caught and focus exclusively on expected errors.
export function isUncheckedError(error) {
  return error instanceof AssertionError ||
    error instanceof TypeError ||
    error instanceof ReferenceError;
}

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
