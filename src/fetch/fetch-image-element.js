import {FetchError} from "/src/fetch/errors.js";
import isAllowedURL, {PermissionsError} from "/src/fetch/fetch-policy.js";
import assert from "/src/utils/assert.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import sprintf from "/src/utils/sprintf.js";
import TimeoutError from "/src/utils/timeout-error.js";

// TODO: use the fetch API to avoid cookies

// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {URL}
// @param timeoutMs {Number}
// @returns {Promise}
export default async function fetchImageElement(url, timeoutMs) {
  assert(url instanceof URL);
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  if(!isAllowedURL(url)) {
    const message = sprintf('Refused to fetch url', url);
    throw new PermissionsError(message);
  }

  let timerId, timeoutPromise;

  const fetchPromise = new Promise(function fetchExec(resolve, reject) {
    const proxy = new Image();
    proxy.src = url.href;// triggers the fetch
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
      const error = new FetchError('Error fetching image with url ' + url.href);
      reject(error);
    };
  });

  if(!timeoutMs) {
    return fetchPromise;
  }

  [timerId, timeoutPromise] = PromiseUtils.setTimeoutPromise(timeoutMs);
  const contestants = [fetchPromise, timeoutPromise];
  const image = await Promise.race(contestants);
  if(image) {
    clearTimeout(timerId);
  } else {
    const message = 'Timed out fetching image with url ' + url.href;
    throw new TimeoutError(message);
  }
  return fetchPromise;
}
