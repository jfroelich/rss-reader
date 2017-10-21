'use strict';

// import base/assert.js
// import base/debug.js
// import http/mime.js
// import http/url.js

const FETCH_DEBUG = false;
const FETCH_UNKNOWN_CONTENT_LENGTH = -1;


// TODO: change functions to return status instead of throwing exceptions

// A 'private' helper function for other fetch functions
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeout_ms {Number} optional, timeout in milliseconds
// @param accept_response {Function} optional, if specified then is passed the
// response, and then the return value is asserted
// @returns {Object} a Response-like object
async function fetch_internal(url, options, timeout_ms, accept_response) {
  // Allow exception to bubble
  // TODO: trap exception. should return error code instead
  const response = await fetch_with_timeout(url, options, timeout_ms);

  // TODO: instead of assert, return error
  // TODO: check typeof === whatever response type should be, be more strict
  // in the assertion. Or maybe that is stupid.
  ASSERT(response);

  // TODO: instead of assert, return error
  ASSERT(response.ok);

  // The spec says 204 is ok, because response.ok is true for status codes
  // 200-299, but I consider 204 to be an error.
  // NOTE: based on errors in the console Chrome may implicitly be treating
  // 204 as a network error, based on seeing "no content errors" that occur
  // sometimes when doing fetch. There may not be a need to explicitly check for
  // this error code. I would need to test further.
  const HTTP_STATUS_NO_CONTENT = 204;
  // TODO: instead of assert, return error
  ASSERT(response.status !== HTTP_STATUS_NO_CONTENT);

  // TODO: instead of assert, return error
  if(accept_response) {
    ASSERT(accept_response(response));
  }

  const response_wrapper = {};

  response_wrapper.text = function() {
    return response.text();
  };

  response_wrapper.request_url = url;
  response_wrapper.response_url = response.url;
  response_wrapper.last_modified_date = fetch_get_last_modified_date(response);
  response_wrapper.redirected = fetch_did_redirect(url, response.url);

  // TODO: return [STATUS_OK, response_wrapper];
  return response_wrapper;
}


// Fetches a feed. Returns a basic object, similar to Response, with custom
// properties.
// @param url {String} the url to fetch
// @param timeout_ms {Number} optional, timeout in milliseconds, before
// considering the fetch a failure
// @param accept_html {Boolean} optional, defaults to true, on whether to
// accept html when validating the mime type of the response. This does not
// affect the request Accept header because servers do not appear to always
// honor Accept headers.
// @returns {Promise} a promise that resolves to a Response-like object
function fetch_feed(url, timeout_ms, accept_html) {
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
  if(accept_html || typeof accept_html === 'undefined')
    types.push('text/html');

  function accept_response(response) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = mime_from_content_type(content_type);
    return types.includes(mime_type);
  }

  return fetch_internal(url, options, timeout_ms, accept_response);
}

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeout_ms {Number} optional, timeout in milliseconds
function fetch_html(url, timeout_ms) {
  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  function accept_response_html_impl(response) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = mime_from_content_type(content_type);
    return mime_type === 'text/html';
  }

  return fetch_internal(url, options, timeout_ms, accept_response_html_impl);
}

// Sends a HEAD request for the given image.
// @param url {String}
// @returns a simple object with props imageSize and response_url_string
async function fetch_image_head(url, timeout_ms) {
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

  // TODO: this should be refactored to use fetch_internal. But I need to
  // calculate content length. So fetch_internal first needs to be refactored
  // to also calculate content length because response is not exposed, just
  // wrapped response.

  const response = await fetch_with_timeout(url, options,
    timeout_ms, 'Fetch timed out ' + url);
  ASSERT(mime_is_image(response.headers.get('Content-Type')));
  const output_response = {};

  // TODO: rename to content_length
  output_response.size = fetch_get_content_length(response);

  output_response.response_url = response.url;
  return output_response;
}

// Fetches an image element. Returns a promise that resolves to a fetched
// image element.
// @param url {String}
// @param timeout_ms {Number}
// @returns {Promise}
// NOTE: urls with data: protocol are fine
// NOTE: timeout of 0 is equivalent to undefined, or untimed fetch
// TODO: should this accept a host document parameter in which to create
// the element (instead of new Image() using document.createElement('img'))
// TODO: maybe rename to fetch_image_element so that separate fetch_image
// that works more like other fetches can be created, and to avoid confusion
// TODO: it is possible this should be using the fetch API to avoid cookies?
function fetch_image(url, timeout_ms) {
  ASSERT(url);

  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;

  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

  // There is no simply way to share information between the promises, so
  // define this in outer scope shared between both promise bodies.
  let timer_id;

  // There is no native way to provide a timeout parameter when fetching an
  // image. So, race a fetch promise against a timeout promise to simulate
  // a timeout parameter.
  // NOTE: there is no penalty for calling clearTimeout with an invalid timer

  const fetch_promise = new Promise(function(resolve, reject) {

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
      clearTimeout(timer_id);
      resolve(proxy);
      return;
    }

    // TODO: handler attachment order may be an issue. Look into it more.
    // I don't think so, but not sure.
    // See https://stackoverflow.com/questions/4776670 . Apparently the proper
    // convention is to always trigger the fetch after attaching the handlers?
    // This should not matter.

    proxy.onload = function proxy_onload(event) {
      clearTimeout(timer_id);
      resolve(proxy);
    };

    proxy.onerror = function proxy_onerror(event) {
      clearTimeout(timer_id);
      // There is no useful error object in the event, so construct our own
      reject(new Error('Failed to fetch ' + url));
    };
  });

  // If no timeout specified then exit early with the fetch promise.
  if(!timeout_ms) {
    return fetch_promise;
  }

  // There is a timeout, so we are going to race
  // TODO: think about binds to reduce callback hell
  const timeout_promise = new Promise(function time_exec(resolve, reject) {
    timer_id = setTimeout(function on_timeout() {
      // The timeout triggered.
      // TODO: prior to settling, cancel the fetch somehow
      // TODO: it could actually be after settling too I think?
      // TODO: i want to cancel the fetch promise itself, and also the
      // fetch_promise promise. actually there is no fetch promise in this
      // context, just the Image.src assignment call. Maybe setting proxy.src
      // to null does the trick?
      reject(new Error('Fetching image timed out ' + url));
    }, timeout_ms);
  });

  return Promise.race([fetch_promise, timeout_promise]);
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
// @param timeout_ms {Number} optional, timeout in milliseconds
// @param error_message {String} optional, timeout error message content
// @returns {Promise} the promise that wins the race
//
// TODO: if fetch succeeds, cancel the timeout
// TODO: if timeout succeeds first, cancel the fetch
function fetch_with_timeout(url, options, timeout_ms, error_message) {
  ASSERT(url_is_valid(url));
  const t_timeout_ms = typeof timeout_ms;

  if(t_timeout_ms !== 'undefined') {
    ASSERT(Number.isInteger(timeout_ms));
    // TODO: the floor should actually be whatever the browser supports, as
    // an explicit reminder that 0ms timeouts are not actually honored by
    // some browsers. I think it is 4ms?
    ASSERT(timeout_ms >= 0);
  }

  const t_error_message = typeof error_message;
  if(t_error_message === 'undefined')
    error_message = 'Fetch timed out for url ' + url;

  const fetch_promise = fetch(url, options);

  // If timeout is not set then do a normal fetch
  if(t_timeout_ms === 'undefined' || timeout_ms === 0)
    return fetch_promise;

  // Not much use for this right now, I think it might be important later
  let timeout_id;

  // I am using this internal function instead of a external helper because of
  // plans to support cancellation
  const timeout_promise = new Promise(function executor(resolve, reject) {
    const error = new Error(error_message);
    timeout_id = setTimeout(reject, timeout_ms, error);
  });

  const promises = [fetch_promise, timeout_promise];
  return Promise.race(promises);
}

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as
// no header present or bad date
function fetch_get_last_modified_date(response) {
  ASSERT(response);

  const last_modified_string = response.headers.get('Last-Modified');
  if(!last_modified_string)
    return;

  try {
    return new Date(last_modified_string);
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
// @param request_url {String} the fetch input url
// @param response_url {String} the value of the response.url property of the
// Response object produced by calling fetch.
function fetch_did_redirect(request_url, response_url) {
  return request_url !== response_url &&
    !url_equals_no_hash(request_url, response_url);
}


// TODO: instead of returning an invalid value, return both an error code and
// the value. This way there is no ambiguity, or need for constant
function fetch_get_content_length(response) {
  const content_length_string = response.headers.get('Content-Length');
  const radix = 10;
  const content_length = parseInt(content_length_string, radix);
  return isNaN(content_length) ? FETCH_UNKNOWN_CONTENT_LENGTH : content_length;
}
