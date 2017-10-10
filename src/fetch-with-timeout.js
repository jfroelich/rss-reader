// Add support for timeout to fetch API

// Dependencies:
// assert.js

// Returns a promise. If no timeout is given the promise is the same promise
// as yielded by calling fetch. If a timeout is given, then a timeout promise
// is raced against the fetch, and whichever promise wins the race is returned.
// If the fetch promise wins the race then generally it will be a resolved
// promise, but it could be rejected for example in case of a network error.
// If the timeout promise wins the race it is always a rejection.
//
// @param url {String} the url to fetch
// @param options {Object} optional, fetch options parameter
// @param timeout_ms {Number} optional, timeout in milliseconds
// @returns {Promise} the promise that wins the race
//
// TODO: if fetch succeeds, cancel the timeout
// TODO: if timeout succeeds first, cancel the fetch
function fetch_with_timeout(url, options, timeout_ms) {
  'use strict';

  ASSERT(typeof url === 'string');


  if(typeof timeout_ms !== 'undefined') {
    ASSERT(Number.isInteger(timeout_ms));

    // TODO: the floor should actually be whatever the browser supports, as
    // an explicit reminder that 0ms timeouts are not actually honored by
    // some browsers. I think it is 4ms?
    ASSERT(timeout_ms >= 0);
  }

  const fetch_promise = fetch(url, options);

  if(!timeout_ms)
    return fetch_promise;

  // Not much use for this right now, I think it might be important later
  let timeout_id;

  const timeout_promise = new Promise(function executor(resolve, reject) {
    const error = new Error(error_message);
    timeout_id = setTimeout(reject, timeout_ms, error);
  });

  const promises = [fetch_promise, timeout_promise];

  return Promise.race(promises);
}
