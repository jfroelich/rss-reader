'use strict';

// import base/number.js
// import net/mime.js
// import net/url.js

const FETCH_UNKNOWN_CONTENT_LENGTH = -1;

// TODO: change functions to return status instead of throwing exceptions

// A 'private' helper function for other fetch functions
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptPredicate {Function} optional, if specified then is passed the
// response, and then the return value is asserted
// @returns {Object} a Response-like object
async function fetchInternal(url, options, timeoutMs, acceptPredicate) {

  // TODO: after the deprecation of assert.js, several of the asserts
  // became weak asserts, when in fact they should be strong assertions.

  // Allow exception to bubble
  // TODO: trap exception. should return error code instead
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
  responseWrapper.last_modified_date = fetchGetLastModifiedDate(response);
  responseWrapper.redirected = fetchDidRedirect(url, response.url);
  return responseWrapper;
}


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

  const headers = {'Accept': ACCEPT_HEADER};
  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': headers,
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
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
    const mimeType = mimeFromContentType(contentType);
    return types.includes(mimeType);
  }

  return fetchInternal(url, options, timeoutMs, acceptPredicate);
}

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds
function fetchHTML(url, timeoutMs) {
  const options = {
    'credentials': 'omit',
    'method': 'get',
    // TODO: use mime.js constant
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  // TODO: move outside of function and rename?
  function acceptHTMLPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mimeFromContentType(contentType);

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

  console.assert(response);

  const contentType = response.headers.get('Content-Type');

  if(!mimeIsImage(contentType)) {
    throw new Error('Response content type not an image mime type: ' +
      contentType + ' for url ' + url);
  }

  // TODO: create and use ReaderResponse
  const outputResponse = {};

  // TODO: fetchGetContentLength should be a method of ReaderResponse
  // TODO: rename outputResponse.size to to outputResponse.contentLength
  outputResponse.size = fetchGetContentLength(response);

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
  console.assert(url);

  if(typeof timeoutMs === 'undefined') {
    timeoutMs = 0;
  }

  console.assert(Number.isInteger(timeoutMs));
  console.assert(timeoutMs >= 0);

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
  console.assert(urlIsValid(url));
  const timeoutMsType = typeof timeoutMs;

  // If timeout is set then check its validity
  if(timeoutMsType !== 'undefined') {
    console.assert(numberIsPositiveInteger(timeoutMs));
  }

  const fetchPromise = fetch(url, options);

  // If timeout is not set then do a normal fetch
  if(timeoutMsType === 'undefined' || timeoutMs === 0) {
    return fetchPromise;
  }

  // Not much use for this right now, I think it might be important later
  let timeoutId;

  // TODO: why the strange syntax?
  const errorMessageType = typeof errorMessage;
  if(errorMessageType === 'undefined') {
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

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as
// no header present or bad date
// TODO: move to ReaderResponse method
function fetchGetLastModifiedDate(response) {
  console.assert(response);

  const lastModifiedString = response.headers.get('Last-Modified');
  if(!lastModifiedString) {
    return;
  }

  try {
    return new Date(lastModifiedString);
  } catch(error) {
  }
}

// Return true if the response url is 'different' than the request url, which
// indicates a redirect in the sense used by this library. This test is done
// due to quirks with fetch response.redirected not working as expected. That
// may be just because I started using the new fetch API as soon as it
// became available and there was a bug that has since been fixed. When first
// using it I witnessed many times that it was false, even though a redirect
// had occurred. I never witnessed it return true.
//
// If the two are exactly equal, then not a redirect. Even if some chain
// of redirects occurred and the terminal url was the same as the initial
// url. If the two are not equal, then a redirect occurred unless the only
// difference is the hash value.
//
// Note there are issues with this hashless comparison, when the '#' symbol
// in the url carries additional meaning, such as when it used like the symbol
// '?'. If I recall this is a simple setting in Apache. I've witnessed it
// in action at Google groups. Simply stripping the hash from the input
// request url when fetching would lead to possibly fetching the wrong
// response (which is how I learned about this, because fetches to Google
// groups all failed in strange ways). This is why fetches occur on urls as is,
// without any hash filtering. So I must pass the hash to fetch, but then I must
// deal with the fact that fetch automatically strips hash information from
// response.url, regardless of how response.redirected is derived.
//
// The response.url yielded by fetch discards the hash, leading to a url that
// is not exactly equal to the input url. This results in something that
// appears to be a new url, that is sometimes in fact still the same url, which
// means no redirect.
//
// TODO: given that it is not identical to the meaning of redirect in the
// spec, or that I am not really clear on it, maybe just be exact in naming.
// Maybe name the function something like fetch_did_url_change? Focusing only
// on how I use urls, instead of whatever a redirect technically is, may be
// a better way to frame the problem.
//
// @param requestURL {String} the fetch input url
// @param responseURL {String} the value of the response.url property of the
// Response object produced by calling fetch.
function fetchDidRedirect(requestURL, responseURL) {
  console.assert(urlIsCanonical(requestURL));
  console.assert(urlIsCanonical(responseURL));

  return requestURL !== responseURL &&
    !urlEqualsNoHash(requestURL, responseURL);
}


// TODO: instead of returning an invalid value, return both an error code and
// the value. This way there is no ambiguity, or need for constant
function fetchGetContentLength(response) {
  const contentLengthString = response.headers.get('Content-Length');
  const radix = 10;
  const contentLength = parseInt(contentLengthString, radix);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
}
