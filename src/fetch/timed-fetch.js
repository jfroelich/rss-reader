
/*
TODO: I am repeatedly using the same fetch timeout code all throughout the
app. Write a helper function here that decorates fetch and provides fetches
that can timeout. Then update all callers to use this instead of repeating
the same pattern everywhere. This also provides a small buffer against
changes in the fetch api. The cost is everything depends on this. But I
suppose that in this case the dependency is reasonable.

NOTE: this is not currently in use, nor tested

*/

async function timed_fetch(url_string, options, timeout_ms) {
  'use strict';

  // Returns a promise that resolves to a setTimeout timer identifier
  function reject_after_timeout(timeout_ms, error_message) {
    function executor(resolve, reject) {
      const error = new Error(error_message);
      return setTimeout(reject, timeout_ms, error);
    }
    return new Promise(executor);
  }

  function timeout_executor(resolve, reject) {
    const error_message = 'Timed out fetching ' + url_string;
    const error = new Error(error_message);
    timeout_id = setTimeout(reject, timeout_ms, error);
  }


  let timeout_id;
  const fetch_promise = fetch(url_string, options);

  // TODO: There is no need to await here, I think. Returning a promise in an
  // async function is a special case. I think. Need to test. I think trying
  // to return a non-promise async wraps that value in a promise, but if
  // returning a promise then it is not wrapped. Not sure.
  if(!timeout_ms)
    return fetch_promise;

  const timeout_promise = new Promise(timeout_executor);
  const promises = [fetch_promise, timeout_promise];

  try {
    const response = await Promise.race(promises);

    // The above line throws if the timeout won the race, which means the
    // remaining statements in this block only execute if the timeout did not
    // occur. If the timeout did not occur we need to cleanup. I am not clear
    // on what it means to eventually reject a resolved/settled promise, but I
    // prefer to avoid it.

    // Passing an invalid id to clearTimeout is a silent noop, so there is no
    // need to guard against it.
    clearTimeout(timeout_id);
    return response;
  } catch(error) {

    // TODO: somehow cancel the fetch here. Something with cancelable fetch,
    // I think Firefox has some experimental feature. There have now been
    // years of discussion on this feature on github.
    // Note there is ambiguity here. This could be a timeout error, or an
    // error due to fetch internals, like a network error, or a type error.
    // If it is a timeout error, cancel the fetch and then throw.
    // If it is a network error, just throw.

    throw error;
  }
}
