// Sends a search request to Google and yields a resulting object consisting
// the properties 'query' and 'entries'. query is a formatted HTML
// string. entries is an array. entries may be empty but is always defined.
// entries contains search result basic objects with the properties url,
// title, link, and contentSnippet, which are all strings.
// Google formally deprecated this service in 2015 but apparently it is still
// working.
// @param query_string {String} a search string using Google search syntax
// @param timeout_ms {Number} a positive integer, optional
async function search_google_feeds(query_string, timeout_ms) {
  'use strict';
  if(typeof query_string !== 'string')
    throw new TypeError('query_string is not a String');
  query_string = query_string.trim();
  if(!query_string.length)
    throw new TypeError('query_string is empty');

  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  if(!Number.isInteger(timeout_ms))
    throw new TypeError('timeout_ms is not an integer');
  if(timeout_ms < 0)
    throw new TypeError('timeout_ms is negative');

  const base_url_string =
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const request_url_string =  base_url_string +
    encodeURIComponent(query_string);

  const headers = {'Accept': 'application/json,text/javascript;q=0.9'};

  const fetch_options = {
    'credentials': 'omit',
    'method': 'GET',
    'headers': headers,
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  const standard_fetch_error_message = request_url_string + ' ' +
    response.status + ' ' + response.statusText;

  const fetch_promise = fetch(request_url_string, fetch_options);
  let response;
  if(timeout_ms) {
    const promises = [];
    promises[0] = fetch_promise;
    promises[1] = new Promise(function executor(resolve, reject) {
      const error = new Error('Request timed out');
      setTimeout(reject, timeout_ms, error);
    });

    response = await Promise.race(promises);
  } else {
    response = await fetch_promise;
  }

  if(!response.ok)
    throw new Error(standard_fetch_error_message);

  const response_status_code = response.status;
  const no_content_status_code = 204;
  if(response_status_code === no_content_status_code)
    throw new Error(standard_fetch_error_message);

  const json_result = await response.json();
  console.assert(typeof json_result === 'object');
  if(typeof json_result.responseData !== 'object')
    throw new Error('responseData is not an object');
  if(!Array.isArray(json_result.responseData.entries))
    throw new Error('responseData.entries is not an array');

  const output_response = {};
  output_response.query = json_result.responseData.query || query_string;
  output_response.entries = json_result.responseData.entries || [];
  output_response.url = response.url;
  return output_response;
}
