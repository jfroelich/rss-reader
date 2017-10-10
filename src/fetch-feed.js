
// TODO: change fetch_feed to not throw in the usual case.
// TODO: this should defer to timed_fetch instead of re-implementing all the
// promise race logic here.
// TODO: if the non-timeout promise wins the race, cancel the timeout. This
// will eventually be a todo of timed_fetch.js

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
  'use strict';
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
  'use strict';
  return new Promise(function executor(resolve, reject) {
    const error = new Error(error_message);
    return setTimeout(reject, timeout_ms, error);
  });
}
