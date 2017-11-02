'use strict';

// import base/number.js

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
// @param query {String} a search string using Google search syntax
// @param timeoutMs {Number} a positive integer, optional

/*
TODO: create a fetch_json function in fetch file somewhere, then defer to that
*/

async function googleFeedsAPISearch(query, timeoutMs) {
  console.assert(typeof query === 'string');
  query = query.trim();

  // The caller should never call this with an empty string (after trim)
  // TODO: maybe this should be tolerated and just return undefined or
  // empty result
  console.assert(query.length);

  if(typeof timeoutMs === 'undefined') {
    timeoutMs = 0;
  }

  console.assert(numberIsPositiveInteger(timeoutMs));

  // TODO: this should probably delegate to a fetch_json function

  const baseURL ='https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const requestURL =  baseURL + encodeURIComponent(query);

  // TODO: defer to mime-utils.js to create somehow
  const headers = {'Accept': 'application/json,text/javascript;q=0.9'};

  const fetchOptions = {
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

  const fetchPromise = fetch(requestURL, fetchOptions);
  let response;
  if(timeoutMs) {
    const promises = [];
    promises[0] = fetchPromise;
    promises[1] = new Promise(function executor(resolve, reject) {
      const error = new Error('Request timed out');
      setTimeout(reject, timeoutMs, error);
    });

    response = await Promise.race(promises);
  } else {
    response = await fetchPromise;
  }

  // TODO: this should not use user supplied values in an error message
  // because it is insecure.
  const standardFetchErrorMessage = requestURL + ' ' +
    response.status + ' ' + response.statusText;


  // TODO: this should not be thrown as an exception because it is not an
  // invariant condition violation. Or is it? If it is, then it should be
  // an console.assert call. If not, then it should return null or something.
  // Should not be an assert. Should return RDR_ERR_FETCH
  if(!response.ok) {
    throw new Error(standardFetchErrorMessage);
  }

  const responseStatusCode = response.status;

  // TODO: same situation as above, should probably not be an exception
  const NO_CONTENT_STATUS_CODE = 204;
  if(responseStatusCode === NO_CONTENT_STATUS_CODE) {
    throw new Error(standardFetchErrorMessage);
  }

  const jsonResult = await response.json();

  // If Google's service did respond, then we expect Google to always produce
  // the same data structure.

  console.dir(jsonResult);
  console.assert(jsonResult);
  console.assert(jsonResult.responseData);
  console.assert(jsonResult.responseData.entries);

  const outputResponse = {};
  outputResponse.query = jsonResult.responseData.query || query;

  // TODO: given the above assert I do not think the || [] is needed?
  outputResponse.entries = jsonResult.responseData.entries || [];
  outputResponse.url = response.url;
  return outputResponse;
}
