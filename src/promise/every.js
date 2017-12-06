import assert from "/src/assert/assert.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";

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
// waiting on a promise near the start of the array. But that doesn't matter, because the function
// as a whole cannot resolve until all promises resolve. So if it blocks early it is only delaying
// the waiting on later promises. Those promises can still resolve out of order in a concurrent
// manner. If it blocks early it is kind of a like a progress bar that slows down for a bit then
// suddenly accelerates for the last half. That's because any early block will allow for other
// unsettled promises to settle, so the later iterations of the for loop that await those promises
// will not be waiting very long, if at all. In other words, this is speed-limited primarily by
// whatever is the slowest promise to resolve, and not really the for loop itself.

// Also keep in mind the behavior when throwing an unchecked exception. Promises are evaluated
// eagerly, when instantiated. That this throws early in event of an unchecked error does not mean
// later promises in the array are not evaluated. It only means they are not awaited.

export default async function every(promises) {
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
        // Comment or uncomment the following statement for debugging
        // console.debug('iteration skipped error', error);
      }
    }

    results.push(result);
  }

  return results;
}
