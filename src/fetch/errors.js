// TODO: describe what these errors represent in a brief comment
// TODO: consider using sprintf and accepting varargs

export class NetworkError extends Error {
  constructor(message) {
    super(message || 'Network error');
  }
}

export class OfflineError extends NetworkError {
  constructor(message) {
    super(message || 'Offline error');
  }
}

export class FetchError extends NetworkError {
  constructor(message) {
    super(message || 'Fetch error');
  }
}
