export class ConstraintError extends Error {
  constructor(message = 'Constraint error') {
    super(message);
  }
}

// This error should occur when something that was expected to exist in the database was not found.
export class NotFoundError extends Error {
  constructor(message = 'Not found error') {
    super(message);
  }
}
