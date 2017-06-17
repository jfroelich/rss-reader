// See license.md

'use strict';

// Sends a search request to Google and yields a resulting object consisting
// the properties 'query' and 'entries'. query is a formatted HTML
// string. entries is an array. entries may be empty but is always defined.
// entries contains search result basic objects with the properties url,
// title, link, and contentSnippet, which are all strings.
// Google formally deprecated this service in 2015 but apparently it is still
// working.
// @param query {String} a search string using Google search syntax
// @param timeout {Number} a positive integer, optional
async function jrGoogleFeedsSearch(query, timeout = 0) {
  jrGoogleFeedsAssertValidQuery(query);
  const url = jrGoogleFeedsCreateRequestURL(query);
  const options = jrGoogleFeedsCreateRequestOptions();
  const response = await jrGoogleFeedsFetch(url, options, timeout);
  jrGoogleFeedsAssertValidResponse(response);
  const result = await response.json();
  const data = result.responseData;
  const outputQuery = data.query || '';
  const outputEntries = data.entries || [];
  return {'query': outputQuery, 'entries': outputEntries};
}

async function jrGoogleFeedsFetch(url, options, timeout) {
  let response;
  if(timeout) {
    const promises = [
      jrGoogleFeedsFetch(url, options),
      jrGoogleFeedsFetchTimeout(timeout)
    ];
    response = await Promise.race(promises);
  } else {
    response = await jrGoogleFeedsFetch(url, options);
  }
  return response;
}

function jrGoogleFeedsCreateRequestOptions() {
  return {
    'credentials': 'omit',
    'method': 'GET',
    'headers': {'Accept': 'application/json,text/javascript;q=0.9'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };
}

function jrGoogleFeedsAssertValidQuery(query) {
  if(typeof query !== 'string' || !query.trim().length)
    throw new TypeError('Invalid query ' + query);
}

function jrGoogleFeedsCreateRequestURL(query) {
  const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  return base + encodeURIComponent(query);
}

function jrGoogleFeedsAssertValidResponse(response) {
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  if(response.status === 204) // No content
    throw new Error(`${response.status} ${response.statusText}`);
}

function jrGoogleFeedsFetchTimeout(timeout) {
  const error = new Error('Request timed out');
  return new Promise((_, reject) =>
    setTimeout(reject, timeout, error));
}
