'use strict';

// import base/number.js

// Returns a promise that resolves to undefined after a certain amount of time,
// as well as the timer id.
// @param timeout_ms {Number} milliseconds, should be >= 0, the browser may
// choose to take longer than specified
function promise_timeout(timeout_ms) {
  console.assert(number_is_positive_integer(timeout_ms));
  let timeout_id;
  const promise = new Promise(function executor(resolve, reject) {
    timeout_id = setTimeout(resolve, timeout_ms);
  });

  // The timer id must be immediately available to the caller before the
  // promise has resolved so that the caller can cancel.
  return [timeout_id, promise];
}

// A variant of Promise.all that does not shortcircuit. This should be
// used instead of the pattern of enclosing promises in a wrapper promise that
// traps exceptions
function promise_every(promises) {
  throw new Error('Not yet implemented');
}
