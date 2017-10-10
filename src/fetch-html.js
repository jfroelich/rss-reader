// Fetch html lib

'use strict';

// TODO: completely rewrite. Once this is rewritten I can merge fetch-feed,
// fetch_with_timeout, and this into a single fetch.js file. The rationale is
// that most of these are one function files, which just feels kind of like
// over-organization, too much granularity of functionality.

// Dependencies
// assert.js

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
