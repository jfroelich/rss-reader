import assert from "/src/common/assert.js";
import {CheckedError} from "/src/common/errors.js";

// Returns a promise that resolves to undefined after a certain amount of time, as well as a
// timer id corresponding to the id of the internal setTimeout call. This returns an array so that
// the caller can use destructuring such as `const [t,p] = setTimeoutPromise(n);`, and so that the
// timer id is available immediately to the caller, so that the caller can optionally cancel the
// promise prior to the promise settling. Promises are not cancelable per se, so exposing the timer
// id immediately is a gimmicky way of making the timeout promise cancelable.
// @param timeoutMs {Number} milliseconds, must be >= 0, that represents the deadline after which to
// resolve. This only guarantees that it waits at least that long, and it may wait longer, because
// some browsers do not respect low timeout values (e.g. under about 16ms). However, this bypasses
// the minimum deadline in the special case of 0, in that case this resolves immediately, where
// immediately means on next-tick not synchronously.
export function setTimeoutPromise(timeoutMs) {
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 0);

  // Depart from browser minimum deadline in this one case
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
