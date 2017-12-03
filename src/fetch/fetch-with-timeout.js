import assert from "/src/assert/assert.js";
import fetchWithTranslatedErrors from "/src/fetch/fetch-with-translated-errors.js";
import {TimeoutError} from "/src/operations/timed-operation.js";
import {isValidURLString} from "/src/url/url-string.js";
import isPosInt from "/src/utils/is-pos-int.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";

// Call fetchWithTranslatedErrors, and race the fetch against a timeout. Throws an error if a
// timeout occurs, or if a fetchWithTranslatedErrors error occurs.
// @param url {String} the url to fetch
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @returns {Promise} the fetch promise
export default async function fetchWithTimeout(url, options, timeoutMs) {
  assert(isValidURLString(url));
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  const fetchPromise = fetchWithTranslatedErrors(url, options);
  if(typeof timeoutMs === 'undefined') {
    return fetchPromise;
  }

  const [timeoutId, timeoutPromise] = setTimeoutPromise(timeoutMs);
  const contestants = [fetchPromise, timeoutPromise];
  const response = await Promise.race(contestants);
  if(response) {
    clearTimeout(timeoutId);
  } else {
    // TODO: cancel/abort the fetch, if that is possible
    const errorMessage = 'Fetch timed out for url ' + url;
    throw new TimeoutError(errorMessage);
  }
  return fetchPromise;
}
