import assert from "/src/utils/assert.js";
import {NetworkError, OfflineError} from "/src/fetch/errors.js";
import formatString from "/src/utils/format-string.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import TimeoutError from "/src/utils/timeout-error.js";

// @param url {URL} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @returns {Promise} the fetch promise
export default async function fetchWithTimeout(url, options, timeoutMs) {
  // Accepting a url ensures the url is canonical and thereby avoids allowing fetch to implicitly
  // resolve a relative url string
  assert(url instanceof URL);
  // Avoid the TypeError fetch throws for invalid options, treat it as an assertion error
  assert(typeof options === 'undefined' || typeof options === 'object');
  const untimed = typeof timeoutMs === 'undefined';
  assert(untimed || isPosInt(timeoutMs));

  // Avoid the TypeError fetch throws when offline, and distinguish this type of network error from
  // other network errors. TypeErrors are unexpected and represent permanent programming errors.
  // Being offline is an expected and temporary error.
  if(!navigator.onLine) {
    const message = formatString('Offline when fetching', url);
    throw new OfflineError(message);
  }

  const fetchPromise = fetch(url.href, options);
  let timeoutId;

  // If a timeout was specified, initialize a derived promise to the result of racing fetch
  // against timeout. Otherwise, initialize a derived promise to the result of fetch.
  let aggregatePromise;
  if(untimed) {
    aggregatePromise = fetchPromise;
  } else {
    let timeoutPromise;
    [timeoutId, timeoutPromise] = PromiseUtils.setTimeoutPromise(timeoutMs);
    const contestants = [fetchPromise, timeoutPromise];
    aggregatePromise = Promise.race(contestants);
  }

  let response;
  try {
    response = await aggregatePromise;
  } catch(error) {
    throwTranslated(url, error);
  }

  // If fetch wins then response is defined.
  // If timeout wins then response is undefined.
  // If fetch errors, that was trapped above
  // Timeout never errors.

  if(response) {
    clearTimeout(timeoutId);
  } else {
    // TODO: cancel/abort the fetch, if that is possible
    const errorMessage = formatString('Fetch timed out for url', url);
    throw new TimeoutError(errorMessage);
  }
  return response;
}

function throwTranslated(url, error) {
  // fetch rejects with a TypeError when a network error is encountered, or when the url contains
  // credentials. It could also be a timeout, but that is a native timeout.
  if(error instanceof TypeError) {
    const message = formatString('Failed to fetch %s because of a network error', url, error);
    throw new NetworkError(message);
  } else {
    // TODO: when does this ever happen?
    console.warn('Unknown error type thrown by fetch', error);
    throw error;
  }
}
