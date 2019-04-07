export default function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

// Return whether the error is equivalent to an assertion error
export function is_assert_error(error) {
  return error instanceof AssertionError || error instanceof ReferenceError;
}

export class AssertionError extends Error {
  constructor(message = 'Assertion error') {
    super(message);
  }
}
