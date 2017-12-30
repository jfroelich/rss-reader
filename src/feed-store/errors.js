import {CheckedError} from "/src/common/errors.js";

// Errors related to reader database operations

export class ConstraintError extends CheckedError {
  constructor(message) {
    super(message);
  }
}

export class NotFoundError extends CheckedError {
  constructor(key) {
    super('Object not found for key ' + key);
  }
}

export class InvalidStateError extends CheckedError {
  constructor(message) {
    super(message);
  }
}
