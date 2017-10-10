// Fetch utilities
'use strict';

// Dependencies:
// assert.js
// debug.js
// mime.js
// url.js

// TODO: fetch_feed and fetch_html share so much logic, I think it makes sense
// to consider designing a helper function like fetch_internal that both use.
// The only differences are basically the response content type validation,
// and how and when body content is accessed. I think this should maybe be the
// top priority to implement. It will also make it very simple to implement
// the various other fetches (json/image/etc). Then each fetch_type function
// becomes simple a parameterized call to fetch_internal

// TODO: change fetch functions to not throw in the usual case. In other words,
// a network error or a 404 type response should not cause exceptions to be
// thrown.
// NOTE: I should wait on implementing the other fetch functions until I see
// the typical pattern from refactoring fetch_feed and fetch_html
// TODO: implement fetch_json and have google feeds call it
// TODO: implement fetch_image_head and move it out of favicon.js
// TODO: implement fetch_image_element and move it out of set-image-dimensions
// TODO: favicon I think also needs to switch to using fetch_html



// Fetches a feed. Returns a basic object, similar to Response, with custom
// properties.
// @param url {String} the url to fetch
// @param timeout_ms {Number} optional, timeout in milliseconds, before
// considering the fetch a failure
// @param accept_html {Boolean} optional, defaults to true, on whether to
// accept html when validating the mime type of the response. This does not
// affect the request Accept header because servers do not appear to always
// honor Accept headers.
async function fetch_feed(url, timeout_ms, accept_html) {
  // Default to accepting html mime type
  if(typeof accept_html === 'undefined')
    accept_html = true;

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

  const response = await fetch_with_timeout(url, options, timeout_ms);

  // TODO: should not assert. should return error code
  ASSERT(fetch_response_is_valid(response));

  // Validate the content type of the response
  const types = ['application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/xml'];
  if(accept_html)
    types.push('text/html');
  const content_type = response.headers.get('Content-Type');
  const mime_type = mime_from_content_type(content_type);

  // TODO: also should not assert
  ASSERT(types.includes(mime_type));

  const response_wrapper = {};

  // TODO: change this to not eagerly fetch text, but instead provide a function
  // that later does it. There are times when I do not want to also read in the
  // text. See how I did this in fetch_html
  // TODO: in order to write fetch_internal and have this share the same
  // helper logic as fetch_html this needs to migrate to the deferred text
  // retrieval
  response_wrapper.text = await response.text();
  response_wrapper.request_url = url;
  response_wrapper.response_url = response.url;

  // TODO: rename this property to last_modified_date
  response_wrapper.lastModifiedDate = fetch_get_last_modified_date(response);
  response_wrapper.redirected = fetch_did_redirect(url, response.url);
  return response_wrapper;
}

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeout_ms {Number} optional, timeout in milliseconds
// TODO: use fetch_with_timeout
async function fetch_html(url, timeout_ms) {
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

  const response = await fetch_with_timeout(url, options, timeout_ms);

  // TODO: should not be assert
  ASSERT(fetch_response_is_valid(response));

  const content_type = response.headers.get('Content-Type');
  const mime_type = mime_from_content_type(content_type);
  // TODO: should not be assert
  ASSERT(mime_type === 'text/html');

  const response_wrapper = {};

  // TODO: rename to request_url
  response_wrapper.requestURLString = url;
  // TODO: rename to response_url
  response_wrapper.responseURLString = response.url;
  response_wrapper.redirected = fetch_did_redirect(url, response.url);

  // TODO: why async/await? Just return the promise?
  response_wrapper.text = async function() {
    return await response.text();
  };

  return response_wrapper;
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

// Returns true if a response is valid (ok), which generally means the response
// has a status code in the range 200..299, except for 204.
function fetch_response_is_valid(response) {
  // TODO: check typeof === whatever response type should be
  ASSERT(response);

  // The spec says 204 is ok, because response.ok is true for status codes
  // 200-299, but I consider 204 to be an error.
  // NOTE: based on errors in the console Chrome may implicitly be treating
  // 204 as a network error, based on seeing "no content errors" that occur
  // sometimes when doing fetch. There may not be a need to explicitly check for
  // this error code. I would need to test further.

  const HTTP_STATUS_NO_CONTENT = 204;
  return response.ok && response.status !== HTTP_STATUS_NO_CONTENT;
}

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as
// no header present or bad date
function fetch_get_last_modified_date(response) {
  // TODO: check typeof === whatever response type should be
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
// indicates a redirect in the sense used by this library.
// Due to quirks with fetch response.redirected not working as expected. That
// may be just because I started using the new fetch API as soon as it
// became available and there was a bug that has since been fixed. I am talking
// about using response.redirected. When first using it I witnessed many times
// that it was false, even though a redirect occurred.
//
// TODO: given that it is not identical to the meaning of redirect in the
// spec, or that I am not really clear on it, maybe just be exact in naming.
// Maybe name the function something like response_is_new_url? Focusing only
// on how I use urls, instead of whatever a redirect technically is, may be
// a better way to frame the problem.
//
// @param request_url {String} the fetch input url
// @param response_url {String} the value of the response.url property of the
// Response object produced by calling fetch.
function fetch_did_redirect(request_url, response_url) {
  ASSERT(typeof request_url === 'string');

  // TODO: validate response_url? Is it required? I've forgotten.

  // If the two are exactly equal, then not a redirect. Even if some chain
  // of redirects occurred and the terminal url was the same as the initial
  // url, this is not a redirect.
  if(request_url === response_url)
    return false;

  // Note there are issues with this hashless comparison, when the '#' symbol
  // in the url carries additional meaning, such as when it used to indicate
  // '?'. If I recall this is a simple setting in Apache. I've witnessed it
  // in action at Google groups. Simply stripping the hash from the input
  // request url when fetching would lead to possibly fetching the wrong
  // response (which is how I learned about this, because fetches to Google
  // groups all failed in strange ways).

  // Normalize each url, and then compare the urls excluding the value of the
  // hash, if present. The response.url yielded by fetch discards this value,
  // leading to a url that is not exactly equal to the input url. This results
  // in something that appears to be a new url, that is in fact still the same
  // url, which means no redirect.

  // TODO: maybe this should be a call to a function in url.js, like
  // a url_ncmp kind of thing (similar to strncmp in c stdlib)

  const request_url_object = new URL(request_url);
  const response_url_object = new URL(response_url);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}
