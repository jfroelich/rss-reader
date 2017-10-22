'use strict';

// import base/number.js

function promise_timeout(timeout_ms) {
  console.assert(number_is_positive_integer(timeout_ms));

  let timeout_id;

  const promise = new Promise(function executor(resolve, reject) {
    timeout_id = setTimeout(resolve, timeout_ms);
  });

  // TODO: the requirement is that the timeout id is externally accessible
  // immediately, from the start of promise execution, and not only later
  // when the promise is resolved. what if I set timeout_id as a hidden expando
  // property of the promise instance?

  return [timeout_id, promise];
}
