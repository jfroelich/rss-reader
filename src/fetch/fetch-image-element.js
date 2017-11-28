import assert from "/src/assert/assert.js";
import {TimeoutError} from "/src/utils/errors.js";
import {FetchError} from "/src/fetch/utils.js";
import isPosInt from "/src/utils/is-pos-int.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";

// TODO: use the fetch API to avoid cookies?


// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {String}
// @param timeoutMs {Number}
// @returns {Promise}
export default async function fetchImageElement(url, timeoutMs) {
  assert(url);
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  // Note that even though the timerId is used after it would be defined later, it still must be
  // defined now. I am not 100% sure why. For simplicity with destructuring call later I also
  // define timeoutPromise here too.
  let timerId, timeoutPromise;

  const fetchPromise = new Promise(function fetchExec(resolve, reject) {
    const proxy = new Image();
    proxy.src = url;// triggers the fetch
    if(proxy.complete) {
      clearTimeout(timerId);
      resolve(proxy);
      return;
    }

    proxy.onload = function proxyOnload(event) {
      clearTimeout(timerId);
      resolve(proxy);
    };
    proxy.onerror = function proxyOnerror(event) {
      clearTimeout(timerId);
      const errorMessage = 'Error fetching image with url ' + url;
      const error = new FetchError(errorMessage);
      reject(error);
    };
  });

  if(!timeoutMs) {
    return fetchPromise;
  }

  [timerId, timeoutPromise] = setTimeoutPromise(timeoutMs);
  const contestants = [fetchPromise, timeoutPromise];
  const image = await Promise.race(contestants);
  if(image) {
    clearTimeout(timerId);
  } else {
    const errorMessage = 'Timed out fetching image with url ' + url;
    throw new TimeoutError(errorMessage);
  }
  return fetchPromise;
}
