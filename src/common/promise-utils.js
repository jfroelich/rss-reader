import assert from "/src/common/assert.js";
import {CheckedError} from "/src/common/errors.js";

// A variant of Promise.all that does not shortcircuit. If any promise rejects, undefined is placed
// in the output array in place of the promise's return value. However, if any project rejects
// with an unchecked error, such as an AssertionError, that causes short-circuiting and the error
// is immediately thrown.
// This was adapted from a twitter post by Jake Archibald
// https://twitter.com/jaffathecake/status/833668073475416064
// For additional implementation notes see issue #436
// It is a bit counter-intuitive as to whether this is concurrent. Keep in mind that merely by
// creating an array of promises, those promises are executing concurrently. Really what this is
// doing when awaiting, is waiting for all promises to settle. Yes, the loop can block early while
// waiting on a promise near the start of the array, but that doesn't matter, because the function
// as a whole cannot resolve until all promises resolve.
// Also keep in mind the behavior when throwing an unchecked exception. Promises are evaluated
// eagerly, when instantiated. That this throws early in event of an unchecked error does not mean
// later promises in the array are not evaluated. It only means they are not awaited.
export async function promiseEvery(promises) {
  assert(Array.isArray(promises));
  const results = [];
  for(const promise of promises) {
    let result;
    try {
      result = await promise;
    } catch(error) {
      if(error instanceof CheckedError) {
        // Swallow the error
        // console.debug('Iteration swallowed checked error', error);
      } else {
        throw error;
      }
    }

    results.push(result);
  }

  return results;
}

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
