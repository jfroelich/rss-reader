// Fetch image element module

// TODO: use the fetch API to avoid cookies?

import assert from "/src/utils/assert.js";
import {TimeoutError} from "/src/utils/errors.js";
import {FetchError} from "/src/fetch/utils.js";
import {isPosInt} from "/src/utils/number.js";
import {setTimeoutPromise} from "/src/utils/promise.js";

// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {String}
// @param timeoutMs {Number}
// @returns {Promise}
export default async function fetchImageElement(url, timeoutMs) {
  assert(url);
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

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

  const [timerId, timeoutPromise] = setTimeoutPromise(timeoutMs);
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
