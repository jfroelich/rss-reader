// Test the specific case of extending error without calling super. The super
// call may be the source of the repeated messages appearing in the console.

export function simple_error_extend_test() {
  class NoSuperError extends Error {}

  class SuperError extends Error {
    constructor(message) {
      super(message);
    }
  }

  try {
    throw new NoSuperError('no super');
  } catch (error) {
    console.dir(error);
  }
}
