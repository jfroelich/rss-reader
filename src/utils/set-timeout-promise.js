import assert from "/src/assert/assert.js";
import isPosInt from "/src/utils/is-pos-int.js";

// setTimeoutPromise is a form of a timed operation. In general, callers should throw a TimeoutError
// from /src/operations/timed-operation.js when the resolution of the timeout promise resolves in a
// way that indicates a time out.

// However, setTimeoutPromise is not a timed operation in the sense that the function itself does
// not throw a TimeoutError. This promise only resolves. Here a promise resolution simply indicates
// the promise resolved without error. This approach also simplifies how the timeout promise can be
// used in conjunction with Promise.race without the need to resort to using try/catch and checking
// if the rejection reason is due to a timeout (the timeout promise winning the race) or due to an
// actual error of some kind (the other promise(s) raced against the timeout rejected).


// Returns a promise that resolves to undefined after a certain amount of time, as well as a
// timer id corresponding to the id of the internal setTimeout call. This returns an array so that
// the caller can use destructuring such as `const [t,p] = setTimeoutPromise(n);`, and so that the
// timer id is available immediately to the caller, so that the caller can optionally cancel the
// promise prior to the promise settling. Promises are not cancelable per se, so exposing the timer
// id immediately is a gimmicky way of making the timeout promise cancelable.
// @param timeoutMs {Number} milliseconds, must be >= 0, that represents the deadline after which to
// resolve. This only guarantees that it waits at least that long, and it may wait longer, because
// some browsers do not respect low timeout values (e.g. under about 16ms).
export default function setTimeoutPromise(timeoutMs) {
  assert(isPosInt(timeoutMs));

  // Note this is special behavior and different than calling setTimeout with a value of 0, because
  // the browser may take even longer. For the case of 0, just immediately return an already
  // resolved promise.
  if(timeoutMs === 0) {
    const FAKE_TIMEOUT_ID = 0;
    const FAKE_RESOLVED_PROMISE = Promise.resolve();
    return [FAKE_TIMEOUT_ID, FAKE_RESOLVED_PROMISE];
  }

  let timeoutId;
  const promise = new Promise(function executor(resolve, reject) {
    timeoutId = setTimeout(resolve, timeoutMs);
  });
  return [timeoutId, promise];
}
