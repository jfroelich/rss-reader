export default function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

// Use this over checking for whether an error is an instanceof AssertionError
// in a catch block wrapping a function call that can produce assertion errors
// when there is an intent to avoid suppressing such errors. There are other
// errors that a catch block can unintentionally suppress such as a missing
// symbol error (a ReferenceError). These other errors are equivalent to an
// assertion level error. Javascript has no panic-equivalent so this is a way to
// simulate the desired behavior.
export function is_assert_error_like(error) {
  // Of the other builtin error types, I think the only one that is lazily
  // computed is reference error when encountering an unknown symbol in a
  // function body. The other errors like SyntaxError are eagerly produced by
  // the interpreter/compiler so there is no need to check for those.
  return error instanceof AssertionError || error instanceof ReferenceError;
}

export class AssertionError extends Error {
  constructor(message = 'Assertion error') {
    super(message);
  }
}
