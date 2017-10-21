'use strict';

// import base/assert.js


function promise_get_timeout(timeout_ms) {
  // These are violations of invariant conditions, more like compile time
  // errors then runtime. This is why these are asserts, and is why these are
  // checked outside of the promise.
  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

  let timeout_id;

  const promise = new Promise(function executor(resolve, reject) {
    timeout_id = setTimeout(function on_timeout() {
      resolve();
    }, timeout_ms);
  });

  // Expose timeout_id immediately and provide a destructurable type
  // I have to break the typical signature of promise-returning
  // functions because timeout_id must be made available immediately so that
  // the promise is pseudo-cancelable.

  // TODO: instead, what if I set timeout_id as a hidden expando property of
  // the promise instance?

  return [timeout_id, promise];
}
