// Fetch utilities

import assert from "/src/assert.js";
import {check, TimeoutError} from "/src/errors.js";
import * as mime from "/src/mime.js";
import {isPosInt} from "/src/number.js";
import {setTimeoutPromise} from "/src/promise.js";
import {parseInt10} from "/src/string.js";
import {compareURLsWithoutHash} from "/src/url.js";
import {isValidURLString} from "/src/url-string.js";

// Sends a HEAD request for the given image.
// @param url {String}
// @returns a simple object with props imageSize and responseURL
// TODO: this should be refactored to use fetchInternal. But I need to calculate content length.
// So fetchInternal first needs to be refactored to also calculate content length because response
// is not exposed, just wrapped response.
// TODO: side note, does HEAD yield 204? If so, 204 isn't an error. So using fetchInternal
// would be wrong, at least as it is currently implemented.
export async function fetchImageHead(url, timeoutMs) {
  const headers = {'Accept': 'image/*'};

  // TODO: set properties in a consistent manner, like I do in other fetch functions
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';

  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(response);
  const contentType = response.headers.get('Content-Type');

  if(contentType === 'unknown') {
    // See https://github.com/jfroelich/rss-reader/issues/459
    console.debug('allowing unknown content type');

  } else {
    check(mime.isImage(contentType), FetchError, 'Response content type not an image mime type: ' +
      contentType + ' for url ' + url);
  }

  // TODO: create and use ResponseWrapper?
  const outputResponse = {};
  outputResponse.size = getContentLength(response);
  outputResponse.responseURL = response.url;
  return outputResponse;
}

// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {String}
// @param timeoutMs {Number}
// @returns {Promise}
// TODO: use the fetch API to avoid cookies?
export async function fetchImageElement(url, timeoutMs) {
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
  check(response.ok, FetchError, 'Response not ok for url ' + url + ', status is ' +
    response.status);

  const HTTP_STATUS_NO_CONTENT = 204;
  check(response.status !== HTTP_STATUS_NO_CONTENT, FetchError, 'no content repsonse ' + url);

  if(typeof acceptPredicate === 'function') {
    check(acceptPredicate(response), FetchError, 'response not accepted ' + url);
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
async function fetchWithTimeout(url, options, timeoutMs) {
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

  // Explicitly check for and throw type errors in parameters passed to this function in order to
  // avoid ambiguity between (1) type errors thrown by fetch due to improper variable type and (2)
  // type errors thrown by fetch due to network errors. Coincidently this also affects a class of
  // invalid inputs to fetch where fetch implicitly converts non-string urls to strings
  check(typeof url === 'string', TypeError, 'url ' + url + ' must be a string');
  check(typeof options === 'undefined' || typeof options === 'object', TypeError,
    'options must be undefined or an object');

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
      // Translate TypeErrors into NetworkErrors
      // When fetch fails with a TypeError, its internal message property does not contain a
      // useful value, so create an error with a useful value.
      throw new NetworkError('Error fetching ' + url);
    } else {

      // TEMP: I am logging this immediately in case the error is promise-swallowed and there are
      // other error types this should also be translating
      console.error(error);

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
function getContentLength(response) {
  const contentLengthString = response.headers.get('Content-Length');

  if(typeof contentLengthString !== 'string' || contentLengthString.length < 1) {
    return FETCH_UNKNOWN_CONTENT_LENGTH;
  }

  const contentLength = parseInt10(contentLengthString);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
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
