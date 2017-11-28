import assert from "/src/assert/assert.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";

const DEBUG = false;

// A variant of Promise.all that does not shortcircuit. If any promise rejects, undefined is placed
// in the output array in place of the promise's return value.
export default async function promiseEvery(promises) {
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
        // Prevent the error from bubbling by ignoring it.

        if(DEBUG) {
          console.debug('iteration skipped error', error);
        }
      }
    }

    results.push(result);
  }

  return results;
}
