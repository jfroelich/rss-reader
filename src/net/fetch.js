'use strict';

// import base/assert.js
// import base/number.js
// import net/mime.js
// import net/url-utils.js

// Fetches a feed. Returns a basic object, similar to Response, with custom
// properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before
// considering the fetch a failure
// @param acceptHTML {Boolean} optional, defaults to true, on whether to
// accept html when validating the mime type of the response. This does not
// affect the request Accept header because servers do not appear to always
// honor Accept headers.
// @returns {Promise} a promise that resolves to a Response-like object
function fetchFeed(url, timeoutMs, acceptHTML) {
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

  const types = ['application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/xml'];

  // TODO: set acceptHTML to true if not defined, this syntax currently
  // is awkward
  if(acceptHTML || typeof acceptHTML === 'undefined') {
    types.push('text/html');
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
function fetchHTML(url, timeoutMs) {
  const options = {
    credentials: 'omit',
    method: 'get',
    // TODO: use mime.js constant
    headers: {'Accept': 'text/html'},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  // TODO: move outside of function and rename?
  function acceptHTMLPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);

    // TODO: use constant from mime.js
    return mimeType === 'text/html';
  }

  return fetchInternal(url, options, timeoutMs, acceptHTMLPredicate);
}

// Sends a HEAD request for the given image.
// @param url {String}
// @returns a simple object with props imageSize and response_url_string
async function fetchImageHead(url, timeoutMs) {
  const headers = {'Accept': 'image/*'};

  // TODO: set properties in a consistent manner, like I do in other fetch
  // functions
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';

  // TODO: this should be refactored to use fetchInternal. But I need to
  // calculate content length. So fetchInternal first needs to be refactored
  // to also calculate content length because response is not exposed, just
  // wrapped response.

  const response = await fetchWithTimeout(url, options,
    timeoutMs, 'Fetch timed out ' + url);

  assert(response);

  const contentType = response.headers.get('Content-Type');

  if(!mime.isImage(contentType)) {
    throw new Error('Response content type not an image mime type: ' +
      contentType + ' for url ' + url);
  }

  // TODO: create and use ReaderResponse
  const outputResponse = {};

  // TODO: ResponseUtils.getContentLength should be a method of ReaderResponse
  // TODO: rename outputResponse.size to to outputResponse.contentLength
  outputResponse.size = ResponseUtils.getContentLength(response);

  outputResponse.responseURL = response.url;
  return outputResponse;
}

// Fetches an image element. Returns a promise that resolves to a fetched
// image element.
// @param url {String}
// @param timeoutMs {Number}
// @returns {Promise}
// NOTE: urls with data: protocol are fine
// NOTE: timeout of 0 is equivalent to undefined, or untimed fetch
// TODO: should this accept a host document parameter in which to create
// the element (instead of new Image() using document.createElement('img'))
// TODO: maybe rename to fetch_image_element so that separate fetchImage
// that works more like other fetches can be created, and to avoid confusion
// TODO: it is possible this should be using the fetch API to avoid cookies?
function fetchImage(url, timeoutMs) {
  assert(url);

  if(typeof timeoutMs === 'undefined') {
    timeoutMs = 0;
  }

  assert(numberIsPositiveInteger(timeoutMs));

  // There is no simply way to share information between the promises, so
  // define this in outer scope shared between both promise bodies.
  let timerId;

  // There is no native way to provide a timeout parameter when fetching an
  // image. So, race a fetch promise against a timeout promise to simulate
  // a timeout parameter.
  // NOTE: there is no penalty for calling clearTimeout with an invalid timer

  const fetchPromise = new Promise(function fetchExec(resolve, reject) {

    // Create an image element within the document running this script
    // TODO: if this promise is to be cancelable I think I might need to
    // define proxy in outer scope of promise, so I can do things like
    // unregister the callback listeners. But how do I ever force the promise
    // to settle? Just leave it unsettled? Isn't that a mem leak? Would that
    // prevent background.js from ever being unloaded?
    const proxy = new Image();
    // Trigger the fetch
    // NOTE: using the old code, url_object.href, was probably the source
    // of the bug. This was getting swallowed by the promise.
    proxy.src = url;

    // Resolve to the proxy immediately if the image is 'cached'
    if(proxy.complete) {
      clearTimeout(timerId);
      resolve(proxy);
      return;
    }

    // TODO: handler attachment order may be an issue. Look into it more.
    // I don't think so, but not sure.
    // See https://stackoverflow.com/questions/4776670 . Apparently the proper
    // convention is to always trigger the fetch after attaching the handlers?
    // This should not matter.

    proxy.onload = function proxyOnload(event) {
      clearTimeout(timerId);
      resolve(proxy);
    };

    proxy.onerror = function proxyOnerror(event) {
      clearTimeout(timerId);
      // There is no useful error object in the event, so construct our own
      reject(new Error('Failed to fetch ' + url));
    };
  });

  // If no timeout specified then exit early with the fetch promise.
  if(!timeoutMs) {
    return fetchPromise;
  }

  // There is a timeout, so we are going to race
  // TODO: consider delegation to promiseTimeout in promise.js
  // TODO: think about binds to reduce callback hell
  const timeoutPromise = new Promise(function timeExec(resolve, reject) {
    timerId = setTimeout(function on_timeout() {
      // The timeout triggered.
      // TODO: prior to settling, cancel the fetch somehow
      // TODO: it could actually be after settling too I think?
      // TODO: i want to cancel the fetch promise itself, and also the
      // fetchPromise promise. actually there is no fetch promise in this
      // context, just the Image.src assignment call. Maybe setting proxy.src
      // to null does the trick?
      reject(new Error('Fetching image timed out ' + url));
    }, timeoutMs);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// A 'private' helper function for other fetch functions
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptPredicate {Function} optional, if specified then is passed the
// response, and then the return value is asserted
// @returns {Object} a Response-like object
async function fetchInternal(url, options, timeoutMs, acceptPredicate) {

  // Allow exception to bubble
  const response = await fetchWithTimeout(url, options, timeoutMs);

  if(!response) {
    throw new Error('response undefined ' + url);
  }

  if(!response.ok) {
    throw new Error('response not ok ' + url);
  }

  // The spec says 204 is ok, because response.ok is true for status codes
  // 200-299, but I consider 204 to be an error.
  // NOTE: based on errors in the console Chrome may implicitly be treating
  // 204 as a network error, based on seeing "no content errors" that occur
  // sometimes when doing fetch. There may not be a need to explicitly check for
  // this error code. I would need to test further.
  const HTTP_STATUS_NO_CONTENT = 204;
  if(response.status === HTTP_STATUS_NO_CONTENT) {
    throw new Error('no content repsonse ' + url);
  }

  if(typeof acceptPredicate === 'function') {
    if(!acceptPredicate(response)) {
      throw new Error('response not accepted ' + url);
    }
  }

  // TODO: create a ReaderResponse class and use that instead of a simple
  // object

  const responseWrapper = {};

  responseWrapper.text = function getBodyText() {
    return response.text();
  };

  responseWrapper.requestURL = url;
  responseWrapper.responseURL = response.url;
  responseWrapper.last_modified_date = ResponseUtils.getLastModified(response);
  responseWrapper.redirected = fetchURLChanged(url, response.url);
  return responseWrapper;
}

// Returns a promise. If no timeout is given the promise is the same promise
// as yielded by calling fetch. If a timeout is given, then a timeout promise
// is raced against the fetch, and whichever promise wins the race is returned.
// If the fetch promise wins the race then generally it will be a resolved
// promise, but it could be rejected for example in case of a network error.
// If the timeout promise wins the race it is always a rejection.
//
// @param url {String} the url to fetch
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param errorMessage {String} optional, timeout error message content
// @returns {Promise} the promise that wins the race
//
// TODO: if fetch succeeds, cancel the timeout
// TODO: if timeout succeeds first, cancel the fetch
function fetchWithTimeout(url, options, timeoutMs, errorMessage) {
  assert(URLUtils.isValid(url));
  const timeoutMsType = typeof timeoutMs;

  // If timeout is set then check its validity
  if(timeoutMsType !== 'undefined') {
    assert(numberIsPositiveInteger(timeoutMs));
  }

  const fetchPromise = fetch(url, options);

  // If timeout is not set then do a normal fetch
  if(timeoutMsType === 'undefined' || timeoutMs === 0) {
    return fetchPromise;
  }

  // Not much use for this right now, I think it might be important later
  let timeoutId;

  if(typeof errorMessage === 'undefined') {
    errorMessage = 'Fetch timed out for url ' + url;
  }

  // TODO: delegate to promiseTimeout in promise.js
  // TODO: resolve instead of reject. But think of how to represent that
  // in case of error? Ok have the promise reject with undefined. The fetch
  // promise never resolves with undefined. So make this function async and
  // await the race and then check whether the response is defined.

  // I am using this internal function instead of a external helper because of
  // plans to support cancellation
  const timeoutPromise = new Promise(function executor(resolve, reject) {
    const error = new Error(errorMessage);
    timeoutId = setTimeout(reject, timeoutMs, error);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

// Return true if the response url is 'different' than the request url,
// ignoring the hash
//
// @param requestURL {String} the fetch input url
// @param responseURL {String} the value of the response.url property of the
// Response object produced by calling fetch.
function fetchURLChanged(requestURL, responseURL) {
  assert(URLUtils.isCanonical(requestURL));
  assert(URLUtils.isCanonical(responseURL));

  return requestURL !== responseURL &&
    !URLUtils.hashlessEquals(requestURL, responseURL);
}

const ResponseUtils = {};

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as
// no header present or bad date
ResponseUtils.getLastModified = function(response) {
  assert(response instanceof Response);

  const lastModifiedString = response.headers.get('Last-Modified');
  if(!lastModifiedString) {
    return;
  }

  try {
    return new Date(lastModifiedString);
  } catch(error) {
  }
};

const FETCH_UNKNOWN_CONTENT_LENGTH = -1;

// TODO: instead of returning an invalid value, return both an error code and
// the value. This way there is no ambiguity, or need for global constant
ResponseUtils.getContentLength = function(response) {
  const contentLengthString = response.headers.get('Content-Length');
  const RADIX = 10;
  const contentLength = parseInt(contentLengthString, RADIX);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
};
