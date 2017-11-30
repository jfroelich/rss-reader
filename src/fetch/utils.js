import assert from "/src/assert/assert.js";
import {FetchError, NetworkError, OfflineError} from "/src/fetch/errors.js";
import {TimeoutError} from "/src/operations/timed-operation.js";
import {compareURLsWithoutHash} from "/src/url/url.js";
import {isValidURLString} from "/src/url/url-string.js";
import check from "/src/utils/check.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as mime from "/src/utils/mime-utils.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";
import {parseInt10} from "/src/utils/string.js";

// TODO: this module grew kind of large for my taste, move some functions into separate files

// Does a fetch with a timeout and a content type predicate
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptPredicate {Function} optional, if specified then is passed the
// response, and then the return value is asserted
// @returns {Object} a Response-like object
export async function fetchInternal(url, options, timeoutMs, acceptPredicate) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(response);
  check(response.ok, FetchError, 'Response not ok for url', url, 'and status is', response.status);

  const HTTP_STATUS_NO_CONTENT = 204;
  check(response.status !== HTTP_STATUS_NO_CONTENT, FetchError, 'No content response', url);

  if(typeof acceptPredicate === 'function') {
    check(acceptPredicate(response), FetchError, 'Response not accepted', url);
  }

  // TODO: create a ReaderResponse class and use that instead of a simple object?

  const responseWrapper = {};
  responseWrapper.text = function getBodyText() {
    return response.text();
  };
  responseWrapper.requestURL = url;
  responseWrapper.responseURL = response.url;
  responseWrapper.lastModifiedDate = getLastModified(response);

  const requestURLObject = new URL(url);
  const responseURLObject = new URL(response.url);
  responseWrapper.redirected = detectURLChanged(requestURLObject, responseURLObject);
  return responseWrapper;
}

// Call fetch, and race the fetch against a timeout. Throws an error if a timeout occurs, or if
// fetch error occurs.
// @param url {String} the url to fetch
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @returns {Promise} the fetch promise
export async function fetchWithTimeout(url, options, timeoutMs) {
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

// Per MDN: https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch
// A fetch() promise will reject with a TypeError when a network error is encountered, although
// this usually means permissions issue or similar. An accurate check for a successful fetch()
// would include checking that the promise resolved, then checking that the Response.ok property
// has a value of true. An HTTP status of 404 does not constitute a network error.

// In this extension, a TypeError is considered a serious error, at the level of an assertion
// error, and not an ephemeral error. Therefore, it is important to capture errors produced by
// calling fetch and translate them. In this case, treat a TypeError as a type of network error,
// which is a type of fetch error, and do not treat the error as a type of TypeError, which is a
// programming error involving using the wrong variable type.
async function fetchWithTranslatedErrors(url, options) {

  // TODO: should these checks be asserts? Right now this is basically using check to throw an
  // unchecked kind of error. TypeError is more specific than AssertionError and both are unchecked.
  // But maybe that specificity isn't worth the fact that this is not the intended use of check,
  // which is only to look at checked errors.

  // Explicitly check for and throw type errors in parameters passed to this function in order to
  // avoid ambiguity between (1) type errors thrown by fetch due to improper variable type and (2)
  // type errors thrown by fetch due to network errors. Coincidently this also affects a class of
  // invalid inputs to fetch where fetch implicitly converts non-string URLs to strings
  check(typeof url === 'string', TypeError, 'url must be a string', url);
  check(typeof options === 'undefined' || typeof options === 'object' || options === null,
    TypeError, 'options must be undefined or an object');

  // If we are able to detect connectivity, then check if we are offline. If we are offline then
  // fetch will fail with a TypeError. But I want to clearly differentiate between a site being
  // unreachable because we are offline from a site being unreachable because the site does not
  // exist. If we cannot detect connectivity then defer to fetch.
  if((typeof navigator !== 'undefined') && ('onLine' in navigator)) {
    check(navigator.onLine, OfflineError, 'Unable to fetch url "%s" while offline', url);
  }

  // Prevent fetch from implicitly assuming that it should use the contextual url of the script as
  // the base url when requesting a relative URI by explicitly checking if the url is relative.
  // When calling the URL constructor without a base url and with a relative url, the constructor
  // throws a TypeError with a message like "Failed to construct URL". This calls the constructor
  // without a try/catch, allowing the TypeError to bubble. Type errors are unchecked errors,
  // similar to assertions, which effectively means that calling this function with a relative url
  // is a programmer error.
  const ensureURLIsNotRelativeURL = new URL(url);

  let response;
  try {
    response = await fetch(url, options);
  } catch(error) {
    if(error instanceof TypeError) {
      // Change type error into network error
      throw new NetworkError('Failed to fetch', url);
    } else {
      console.warn('Untranslated error', error);
      throw error;
    }
  }

  return response;
}

// Return true if the response url is 'different' than the request url
// @param requestURL {URL}
// @param responseURL {URL}
function detectURLChanged(requestURL, responseURL) {
  return !compareURLsWithoutHash(requestURL, responseURL);
}

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as no header present or
// bad date
function getLastModified(response) {
  assert(response instanceof Response);
  const lastModifiedString = response.headers.get('Last-Modified');
  if(lastModifiedString) {
    try {
      return new Date(lastModifiedString);
    } catch(error) {
      // Ignore
    }
  }
}

export const FETCH_UNKNOWN_CONTENT_LENGTH = -1;

// TODO: just return NaN if NaN? NaN is suitable unknown type.
export function getContentLength(response) {
  const contentLengthString = response.headers.get('Content-Length');

  if(typeof contentLengthString !== 'string' || contentLengthString.length < 1) {
    return FETCH_UNKNOWN_CONTENT_LENGTH;
  }

  const contentLength = parseInt10(contentLengthString);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
}
