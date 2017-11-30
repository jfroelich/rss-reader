import sprintf from "/src/utils/sprintf.js";

// Represents a general class of networking errors, such as unavailability or unreachability of a
// resource located on a different machine
export class NetworkError extends Error {
  constructor(...args) {
    super(sprintf(...args) || 'Network error');
  }
}

// Represents a specific type of networking error where the current computer cannot access any
// resources on other machines
export class OfflineError extends NetworkError {
  constructor(...args) {
    if(args.length) {
      super(...args);
    } else {
      super('Offline error');
    }
  }
}

// Represents a general class of errors relating to fetching a resource from another machine, such
// as requesting the wrong type of resource, or unauthorized, etc.
export class FetchError extends NetworkError {
  constructor(...args) {
    if(args.length) {
      super(...args);
    } else {
      super('Fetch error');
    }
  }
}
