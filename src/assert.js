// Assertion checks should only be used to catch certain kinds of errors. In
// general, assertion errors should represent the violation of an invariant
// guarantee. In other words, a condition that never changes, it is always true.
// E.g. this function calls out to some other function that is always defined,
// so it makes sense to assert that other function exists.

// Because JavaScript has no c-like panic equivalent, every call stack that
// involves lower level functions that perform assertions must be treated as
// suspect, and all higher level calling code must be careful to not
// accidentally suppress assertion errors. Every catch block higher in the stack
// must check if the error is an assertion error and rethrow the error
// unhandled, unsuppressed, or risk accidental suppression of assertion errors.

export default function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export class AssertionError extends Error {
  constructor(message = 'Assertion error') {
    super(message);
  }
}
