'use strict';

// import base/assert.js
// import base/number.js

// Returns a promise that resolves to undefined after a certain amount of time,
// as well as the timer id. This returns an array so that the caller can use
// destructuring such as const [t,p] = promiseTimeout(n);
// @param timeoutMs {Number} milliseconds, should be >= 0, the browser may
// choose to take longer than specified
function promiseTimeout(timeoutMs) {
  assert(numberIsPositiveInteger(timeoutMs));
  let timeoutId;
  const promise = new Promise(function executor(resolve, reject) {
    timeoutId = setTimeout(resolve, timeoutMs);
  });

  // The timer id must be immediately available to the caller before the
  // promise has resolved so that the caller can cancel.
  return [timeoutId, promise];
}

// A variant of Promise.all that does not shortcircuit. If any promise rejects,
// undefined is placed in the output array in place of the promise's return
// value.
function promiseEvery(promises) {
  assert(Array.isArray(promises));
  const noop = function() {};
  const trap = function(p) { return p.catch(noop); };
  const trapped = promises.map(trap);
  return Promise.all(trapped);
}
