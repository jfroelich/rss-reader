// Promise utilities

// TODO: break apart into two files, export default from each. While these functions both deal with
// promises, there is actually very little coherency. The functions do not call each other.


import assert from "/src/utils/assert.js";
import {isUncheckedError} from "/src/utils/errors.js";
import {isPosInt} from "/src/utils/number.js";

// Returns a promise that resolves to undefined after a certain amount of time, as well as the
// timer id. This returns an array so that the caller can use destructuring such as
// const [t,p] = setTimeoutPromise(n);
// @param timeoutMs {Number} milliseconds, must be >= 0, the browser may
// choose to take longer than specified
export function setTimeoutPromise(timeoutMs) {
  assert(isPosInt(timeoutMs));

  // Note this is special behavior and different than calling setTimeout with a value of 0, because
  // the browser may take even longer.
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

const DEBUG_EVERY_ERRORS = false;

// A variant of Promise.all that does not shortcircuit. If any promise rejects, undefined is placed
// in the output array in place of the promise's return value.
export async function promiseEvery(promises) {
  assert(Array.isArray(promises));
  const results = [];
  for(const promise of promises) {
    let result;
    try {
      result = await promise;
    } catch(error) {
      if(isUncheckedError(error)) {
        throw error;
      } else {
        if(DEBUG_EVERY_ERRORS) {
          // Prevent the error from bubbling by ignoring it.
          console.debug('iteration skipped error', error);
        }
      }
    }

    results.push(result);
  }

  return results;
}
