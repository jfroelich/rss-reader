'use strict';

// TODO: change fetch_feed to not throw in the usual case.
// TODO: this should defer to timed_fetch instead of re-implementing all the
// promise race logic here.
// TODO: if the non-timeout promise wins the race, cancel the timeout. This
// will eventually be a todo of timed_fetch.js
// TODO: implement fetch_json and have google feeds call it

// Dependencies:
// assert.js
// response.js

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
  ASSERT(typeof url === 'string');
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

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

  const fetch_promise = fetch(url, options);
  let response;
  if(timeout_ms) {
    const error_message = 'Fetch timed out for url ' + url;
    const timeout_promise = fetch_feed_reject_after_timeout(timeout_ms,
      error_message);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else {
    response = await fetch_promise;
  }

  // TODO: these should not be asserts. should return error code instead
  ASSERT(response_is_valid(response));

  const types = ['application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/xml'];
  if(accept_html)
    types.push('text/html');
  ASSERT( types.includes( response_get_type(response) ) );

  const output = {};

  // TODO: change this to not eagerly fetch text, but instead provide a function
  // that later does it. There are times when I do not want to also read in the
  // text
  output.text = await response.text();
  output.request_url = url;
  output.response_url = response.url;

  // TODO: rename this property to last_modified_date
  output.lastModifiedDate = response_get_last_modified_date(response);
  output.redirected = response_is_redirect(url, response.url);
  return output;
}

// Returns a promise that resolves to a setTimeout timer identifier
// TODO: I think this would be better located in something like promise.js.
// However, I am also thinking that it will be removed when I switched to using
// the timed fetch functionality. The current implementation also makes it
// to difficult to cancel the timeout if the fetch succeeds, or cancel the
// fetch if the timeout succeeds.
function fetch_feed_reject_after_timeout(timeout_ms, error_message) {
  return new Promise(function executor(resolve, reject) {
    const error = new Error(error_message);
    return setTimeout(reject, timeout_ms, error);
  });
}

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeout_ms {Number} optional, timeout in milliseconds
async function fetch_html(url, timeout_ms) {
  ASSERT(typeof url === 'string');

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

  const fetch_promise = fetch(url, options);
  let response;
  if(timeout_ms) {
    const timeout_promise = fetch_html_reject_after_timeout(url, timeout_ms);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else
    response = await fetch_promise;

  // TODO: these should not be asserts, these are typical data-related errors
  // and not indicators of a violation of an invariant condition
  ASSERT(response_is_valid(response));
  ASSERT(response_get_type(response) === 'text/html');

  const output_response = {};
  output_response.requestURLString = url;
  output_response.responseURLString = response.url;
  output_response.redirected = response_is_redirect(url, response.url);

  // TODO: why async/await? Just return the promise?
  output_response.text = async function() {
    return await response.text();
  };

  return output_response;
}

function fetch_html_reject_after_timeout(url, timeout_ms) {
  return new Promise(function executor(resolve, reject) {
    const error = new Error('Request timed out');
    setTimeout(reject, timeout_ms, error);
  });
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
// @returns {Promise} the promise that wins the race
//
// TODO: if fetch succeeds, cancel the timeout
// TODO: if timeout succeeds first, cancel the fetch
function fetch_with_timeout(url, options, timeout_ms) {
  ASSERT(typeof url === 'string');


  if(typeof timeout_ms !== 'undefined') {
    ASSERT(Number.isInteger(timeout_ms));

    // TODO: the floor should actually be whatever the browser supports, as
    // an explicit reminder that 0ms timeouts are not actually honored by
    // some browsers. I think it is 4ms?
    ASSERT(timeout_ms >= 0);
  }

  const fetch_promise = fetch(url, options);

  if(!timeout_ms)
    return fetch_promise;

  // Not much use for this right now, I think it might be important later
  let timeout_id;

  const timeout_promise = new Promise(function executor(resolve, reject) {
    const error = new Error(error_message);
    timeout_id = setTimeout(reject, timeout_ms, error);
  });

  const promises = [fetch_promise, timeout_promise];

  return Promise.race(promises);
}
