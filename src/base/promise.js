'use strict';

// import base/assert.js

function promise_timeout(timeout_ms) {
  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);
  let timeout_id;

  const promise = new Promise(function executor(resolve, reject) {
    timeout_id = setTimeout(resolve, timeout_ms);
  });

  // TODO: what if I set timeout_id as a hidden expando property of
  // the promise instance?

  return [timeout_id, promise];
}
