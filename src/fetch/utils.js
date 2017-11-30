import assert from "/src/assert/assert.js";
import {TimeoutError} from "/src/operations/timed-operation.js";
import check from "/src/utils/check.js";
import {compareURLsWithoutHash} from "/src/url/url.js";
import {isValidURLString} from "/src/url/url-string.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as mime from "/src/utils/mime-utils.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";
import {parseInt10} from "/src/utils/string.js";

// TODO: this grew kind of large for my taste, move some functions into separate files

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
// error, and not an ephemeral or bad-input error. Therefore, it is important to capture
// errors produced by calling fetch and translate them. In this case, treat a TypeError as
// a type of network error, which is a type of fetch error, and do not treat the error as a type
// of TypeError, which is a programming error involving using the wrong variable type. My
// suspicion is that the designers of the fetch API did not want to create a new error type, and
// decided to use TypeError as a catch-all type of error.
async function fetchWithTranslatedErrors(url, options) {

  // TODO: should these checks be asserts?
  // Explicitly check for and throw type errors in parameters passed to this function in order to
  // avoid ambiguity between (1) type errors thrown by fetch due to improper variable type and (2)
  // type errors thrown by fetch due to network errors. Coincidently this also affects a class of
  // invalid inputs to fetch where fetch implicitly converts non-string urls to strings
  check(typeof url === 'string', TypeError, 'url must be a string', url);
  check(typeof options === 'undefined' || typeof options === 'object' || options === null,
    TypeError, 'options must be undefined or an object');

  // If we are able to detect connectivity, then check if we are offline. If we are offline then
  // fetch will fail. But I want to clearly differentiate between a site being unreachable because
  // we are offline from a site being unreachable because the site does not exist.
  if((typeof navigator !== 'undefined') && ('onLine' in navigator)) {
    check(navigator.onLine, OfflineError, 'Unable to fetch url "%s" while offline', url);
  }

  // We know that url is now a string, but we do not know if it is an absolute url. When calling
  // fetch with a url string that is not absolute, fetch implicitly resolves the url using the
  // location of the calling context. This leads to undesired behavior. Fetches to the local context
  // should not be allowed unless it is explictly done using an absolute url pointing to a local
  // resource (e.g. includes chrome-extension:// in the url).
  // Avoid fetch defaulting to trying to fetch using window.location or whatever as the base url in
  // the case of a relative url. Calling the URL constructor with a relative URL and without a base
  // url parameter throws a TypeError.
  // Although this additional behavior probably does not belong in this function in the sense that
  // the absolute-url requirement is an unexpected implicit requirement, I am performing it here
  // because of the possible confusion that arises when delegating the check to a function lower
  // on the stack. If lower on the stack, a type error would bubble up to this function and then
  // get translated into a network error. This isn't a network error. Similarly, if the function
  // were higher on the stack, some confusion could occur. Well, not really. Maybe this should
  // be higher on the stack (a wrapper function that does this check, then calls this). But the two
  // situations are orthogonal? Anyway I am not sure, going with this implementation choice for now.
  new URL(url);

  let response;
  try {
    response = await fetch(url, options);
  } catch(error) {
    if(error instanceof TypeError) {
      // fetch throws a TypeError for certain network errors. This would ordinarily be acceptable
      // behavior in other applications, but in this application a type error is unchecked.
      // Therefore, this translates type errors into network errors. Type errors are unchecked and
      // represent incorrect use of a variable. NetworkErrors are checked and represent a kind of
      // fetch error.
      // The type error message is not useful or revealing, it just says "Failed to fetch", so
      // create a more useful message.
      throw new NetworkError('Failed to fetch ' + url);
    } else {
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

// TODO: move these to /src/fetch/errors.js

// TODO: I implemented this without thinking how it relates to other errors. It may be more
// appropriate to extend networkerror or whatever.
export class OfflineError extends Error {
  constructor(message) {
    super(message || 'Offline error');
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message || 'Network error');
  }
}

export class FetchError extends NetworkError {
  constructor(message) {
    super(message || 'Fetch error');
  }
}
