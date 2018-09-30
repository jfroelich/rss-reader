// This error should occur when either an operation against the database is in
// the wrong state, or the data involved in the operation is in the wrong state.
export class InvalidStateError extends Error {
  constructor(message = 'InvalidStateError') {
    super(message);
  }
}

// This error should occur when something that was expected to exist in the
// database was not found.
export class NotFoundError extends Error {
  constructor(message = 'The data expected to be found was not found') {
    super(message);
  }
}
