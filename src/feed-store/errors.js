// Errors related to reader database operations

export class ConstraintError extends Error {
  constructor(message) {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(key) {
    super('Object not found for key ' + key);
  }
}

export class InvalidStateError extends Error {
  constructor(message) {
    super(message);
  }
}
