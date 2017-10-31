'use strict';

// TODO: deprecate entirely, no longer works at all, Google returns 403
// forbidden response code

// TODO: actually, rewrite to instead just query google, appending
// "filetype:rss" to the query. First look for whether google has a search
// api for javascript
// https://developers.google.com/custom-search/json-api/v1/overview

// Hmmm, seems site specific so basically there is no recourse

// Sends a search request to Google and yields a resulting object consisting
// the properties 'query' and 'entries'. query is a formatted HTML
// string. entries is an array. entries may be empty but is always defined.
// entries contains search result basic objects with the properties url,
// title, link, and contentSnippet, which are all strings.
// Google formally deprecated this service in 2015 but apparently it is still
// working.
// @param query_string {String} a search string using Google search syntax
// @param timeout_ms {Number} a positive integer, optional

/*
TODO: create a fetch_json function in fetch file somewhere, then defer to that
*/

async function google_feeds_api_search(query_string, timeout_ms) {
  console.assert(typeof query_string === 'string');
  query_string = query_string.trim();

  // The caller should never call this with an empty string (after trim)
  // TODO: maybe this should be tolerated and just return undefined or
  // empty result
  console.assert(query_string.length);

  if(typeof timeout_ms === 'undefined') {
    timeout_ms = 0;
  }

  console.assert(Number.isInteger(timeout_ms));
  console.assert(timeout_ms >= 0);

  // TODO: this should probably delegate to a fetch_json function

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


  // TODO: delegate timed fetching to timed-fetch.js

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

  // TODO: this should not use user supplied values in an error message
  // because it is insecure.
  const standard_fetch_error_message = request_url_string + ' ' +
    response.status + ' ' + response.statusText;


  // TODO: this should not be thrown as an exception because it is not an
  // invariant condition violation. Or is it? If it is, then it should be
  // an console.assert call. If not, then it should return null or something.
  // Should not be an assert. Should return RDR_ERR_FETCH
  if(!response.ok)
    throw new Error(standard_fetch_error_message);

  const response_status_code = response.status;

  // TODO: same situation as above, should probably not be an exception
  const no_content_status_code = 204;
  if(response_status_code === no_content_status_code) {
    throw new Error(standard_fetch_error_message);
  }

  const json_result = await response.json();

  // If Google's service did respond, then we expect Google to always produce
  // the same data structure.

  console.dir(json_result);
  console.assert(json_result);
  console.assert(json_result.responseData);
  console.assert(json_result.responseData.entries);

  const output_response = {};
  output_response.query = json_result.responseData.query || query_string;

  // TODO: given the above assert I do not think the || [] is needed?
  output_response.entries = json_result.responseData.entries || [];
  output_response.url = response.url;
  return output_response;
}
