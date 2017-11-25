import assert from "/src/assert.js";
import isPosInt from "/src/utils/is-pos-int.js";

// Returns a promise that resolves to undefined after a certain amount of time, as well as a
// timer id corresponding to the id of the internal setTimeout call. This returns an array so that
// the caller can use destructuring such as `const [t,p] = setTimeoutPromise(n);`.
// @param timeoutMs {Number} milliseconds, must be >= 0, that represents the deadline after to
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
