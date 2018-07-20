// TODO: what if instead i did base.js, a shared utilities module imported by
// most of the other modules? assert would just be one member of that along with
// some other common things like maybe a noop function

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
