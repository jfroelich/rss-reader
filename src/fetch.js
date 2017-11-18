// Fetch utilities

import assert from "/src/assert.js";
import {check, TimeoutError} from "/src/errors.js";
import * as mime from "/src/mime.js";
import {isPosInt} from "/src/number.js";
import {setTimeoutPromise} from "/src/promise.js";
import {parseInt10} from "/src/string.js";
import {compareURLsWithoutHash} from "/src/url.js";
import {isValidURLString} from "/src/url-string.js";

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param acceptHTML {Boolean} optional, defaults to true, on whether to accept html when validating
// the mime type of the response. This does not affect the request Accept header because servers do
// not appear to always honor Accept headers.
// @returns {Promise} a promise that resolves to a Response-like object
export function fetchFeed(url, timeoutMs, acceptHTML) {
  if(typeof acceptHTML === 'undefined') {
    acceptHTML = true;
  }

  const ACCEPT_HEADER = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const headers = {Accept: ACCEPT_HEADER};
  const options = {
    credentials: 'omit',
    method: 'get',
    headers: headers,
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const types = ['application/rss+xml', 'application/rdf+xml', 'application/atom+xml',
    'application/xml', 'text/xml'];
  if(acceptHTML) {
    types.push(mime.MIME_TYPE_HTML);
  }

  function acceptPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return types.includes(mimeType);
  }

  return fetchInternal(url, options, timeoutMs, acceptPredicate);
}

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds
export function fetchHTML(url, timeoutMs) {
  const options = {
    credentials: 'omit',
    method: 'get',
    headers: {'Accept': mime.MIME_TYPE_HTML},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  function acceptHTMLPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return mimeType === mime.MIME_TYPE_HTML;
  }
  return fetchInternal(url, options, timeoutMs, acceptHTMLPredicate);
}

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

  check(mime.isImage(contentType), FetchError, 'Response content type not an image mime type: ' +
    contentType + ' for url ' + url);

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
// TODO: it is possible this should be using the fetch API to avoid cookies?
export function fetchImageElement(url, timeoutMs) {
  assert(url);
  assert(typeof timeoutMs === 'undefined' || isPosInt(timeoutMs));

  const fetchPromise = new Promise(function fetchExec(resolve, reject) {
    const proxy = new Image();
    proxy.src = url;// triggers the fetch

    // Resolve immediately if the image is cached
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
      reject(new TimeoutError('Timed out fetching ' + url));
    };
  });

  // If no timeout specified then exit early with the fetch promise.
  if(!timeoutMs) {
    return fetchPromise;
  }

  let timerId;

  // There is a timeout provided, so we are going to race
  // TODO: delegate to setTimeoutPromise
  const timeoutPromise = new Promise(function timeExec(resolve, reject) {
    timerId = setTimeout(function onTimeout() {
      // The timeout triggered.
      // TODO: prior to settling, cancel the fetch somehow
      reject(new TimeoutError('Fetching image timed out ' + url));
    }, timeoutMs);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// Does a fetch with a timeout and a content type predicate
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptPredicate {Function} optional, if specified then is passed the
// response, and then the return value is asserted
// @returns {Object} a Response-like object
async function fetchInternal(url, options, timeoutMs, acceptPredicate) {
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

  const fetchPromise = fetch(url, options);
  if(!timeoutMs === 'undefined') {
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

function getContentLength(response) {
  const contentLengthString = response.headers.get('Content-Length');
  const contentLength = parseInt10(contentLengthString);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
}

export class FetchError extends Error {
  constructor(message) {
    super(message || 'Fetch error');
  }
}
