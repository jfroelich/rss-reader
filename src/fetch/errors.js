import sprintf from "/src/utils/sprintf.js";

// TODO: describe what these errors represent in a brief comment

export class NetworkError extends Error {
  constructor(...args) {
    super(sprintf(...args) || 'Network error');
  }
}

export class OfflineError extends NetworkError {
  constructor(...args) {
    super(args.length ? ... args : 'Offline error');
  }
}

export class FetchError extends NetworkError {
  constructor(...args) {
    super(args.length ? ... args : 'Fetch error');
  }
}
