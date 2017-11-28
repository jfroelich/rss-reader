
// A timed operation is any function that can timeout. When a timed operation times out, it should
// throw a TimeoutError.

// A TimeoutError is a checked form of an error. It is expected and typical/routine, and not
// indicative of a serious programmer error. It simply means something did not complete in time.

export class TimeoutError extends Error {
  constructor(message) {
    super(message || 'Operation timed out');
  }
}
