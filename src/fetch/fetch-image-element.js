import assert from "/src/assert/assert.js";
import {FetchError} from "/src/fetch/errors.js";
import isAllowedURL, {PermissionsError} from "/src/fetch/fetch-policy.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import sprintf from "/src/utils/sprintf.js";
import TimeoutError from "/src/utils/timeout-error.js";

// TODO: for consistency with other fetch calls, and to avoid the need to do it here, this should
// expect a URL object as the parameter type, instead of a string


// TODO: use the fetch API to avoid cookies

// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {String}
// @param timeoutMs {Number}
// @returns {Promise}
export default async function fetchImageElement(url, timeoutMs) {
  assert(typeof url === 'string');
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  // Issue #420. All requests should undergo policy check. Because this does not use fetchInternal
  // like other requests, which would implicitly check policy, do an explicit policy check.
  // Due to the heavy cost of parsing urls with the data protocol, and because all data uris are
  // permitted, only check if not a data uri.
  if(!isDataURI(url)) {
    const urlObject = new URL(url);

    if(!isAllowedURL(urlObject)) {
      const message = sprintf('Refused to fetch url', url);
      throw new PermissionsError(message);
    }
  }

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
      const error = new FetchError('Error fetching image with url', url);
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
    const errorMessage = 'Timed out fetching image with url ' + url;
    throw new TimeoutError(errorMessage);
  }
  return fetchPromise;
}

function isDataURI(urlString) {
  return /\s*data:/i.test(urlString);
}
