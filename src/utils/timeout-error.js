// A TimeoutError is a checked form of an error. It is expected and typical/routine, and not
// indicative of a serious programmer error. It simply means something did not complete in time.
// For example, opening a database connection, or fetching a remote resource.

export default class TimeoutError extends Error {
  constructor(message) {
    super(message || 'Operation timed out');
  }
}
