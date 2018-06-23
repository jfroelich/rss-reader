export function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export class AssertionError extends Error {
  constructor(message = 'Assertion error') {
    super(message);
  }
}
