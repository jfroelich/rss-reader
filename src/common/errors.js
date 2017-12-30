
export class CheckedError extends Error {
  constructor(message) {
    super(message);
  }
}

// A TimeoutError means something did not complete in time.
// For example, opening a database connection, or fetching a remote resource.
export class TimeoutError extends CheckedError {
  constructor(message) {
    super(message || 'Operation timed out');
  }
}
