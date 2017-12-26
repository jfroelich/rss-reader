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
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  // Avoid the TypeError fetch throws when offline, and distinguish this type of network error from
  // other network errors.
  if(!navigator.onLine) {
    const message = formatString('Unable to fetch url "%s" while offline', url);
    throw new OfflineError(message);
  }

  const fetchPromise = fetchWithTranslatedErrors(url, options);
  if(typeof timeoutMs === 'undefined') {
    return fetchPromise;
  }

  const [timeoutId, timeoutPromise] = PromiseUtils.setTimeoutPromise(timeoutMs);
  const contestants = [fetchPromise, timeoutPromise];
  const response = await Promise.race(contestants);
  if(response) {
    clearTimeout(timeoutId);
  } else {
    // TODO: cancel/abort the fetch, if that is possible
    const errorMessage = formatString('Fetch timed out for url', url.href);
    throw new TimeoutError(errorMessage);
  }
  return fetchPromise;
}

// Wraps a call to fetch and changes the types of certain errors thrown. The primary problem
// solved is that my app considers a TypeError as indicative of a critical, permanent, unexpected,
// unchecked, programmer syntax error, but fetch throws TypeError errors for other reasons that
// are ephemeral, such as when a network error occurs, or when a url happens to contain credentials.
// @param url {URL} request url
// @param options {Object} optional, options variable passed directly to the fetch call
async function fetchWithTranslatedErrors(url, options) {
  let response;
  try {
    response = await fetch(url.href, options);
  } catch(error) {
    // fetch rejects with a TypeError when a network error is encountered, or when the url contains
    // credentials.
    if(error instanceof TypeError) {
      throw new NetworkError('Failed to fetch', url, 'because of a checked error', error);
    }

    // TODO: when does this ever happen?
    console.warn('Unknown error type thrown by fetch', error);
    throw error;
  }
  return response;
}
