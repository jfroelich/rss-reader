// See license.md

'use strict';

// Sends a search request to Google and yields a resulting object consisting
// the properties 'query' and 'entries'. query is a formatted HTML
// string. entries is an array. entries may be empty but is always defined.
// entries contains search result basic objects with the properties url,
// title, link, and contentSnippet, which are all strings.
// Google formally deprecated this service in 2015 but apparently it is still
// working.
// @param queryString {String} a search string using Google search syntax
// @param timeoutMillis {Number} a positive integer, optional
async function searchGoogleFeeds(queryString, timeoutMillis = 0) {

  if(typeof queryString !== 'string') {
    throw new TypeError('queryString is not a defined String object');
  }

  // It is faster to check it here than to wait until the request fails. It
  // also avoids the number of bad queries sent to Google.
  if(!queryString.trim().length) {
    throw new TypeError('queryString is empty');
  }

  // TODO: use the new URL object and set the parameter using searchParams
  // which I think does the encoding for me, so there is no need to use
  // encodeURIComponent

  const baseString =
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const urlString =  baseString + encodeURIComponent(queryString);

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


  // The new fetch api no longer supports timeouts. Fake a timeout by racing
  // a timeout promise against the fetch promise. If the timeout wins the race
  // then Promise.race throws an error in the context of an async function.
  const fetchPromise = fetch(urlString, fetchOptions);
  let responseObject;
  if(timeoutMillis) {
    const promises = new Array(2);
    promises[0] = fetchPromise;
    promises[1] = new Promise(function(resolve, reject) {
      const error = new Error('Request timed out');
      setTimeout(reject, timeoutMillis, error);
    });

    responseObject = await Promise.race(promises);
  } else {
    responseObject = await fetchPromise;
  }

  // Generally, ok is false if response code is not in range 200-299
  if(!responseObject.ok) {
    throw new Error('searchGoogleFeeds fetch error ' + responseObject.status +
      ' ' + responseObject.statusText);
  }

  // Treat 204 No content response as an error. The ok variable above considers
  // a 204 response as ok, but my policy is different.
  if(responseObject.status === 204) {
    throw new Error(`searchGoogleFeeds received a response without content`);
  }

  // Parse the json-formatted response text into a javascript object
  const jsonResultObject = await responseObject.json();

  // Google wraps the data in an outer object, so get the data within
  const responseDataObject = jsonResultObject.responseData;

  // Rather than return the raw data, I keep only the properties I want, and
  // I also ensure they are not undefined to increase caller convenience.

  const outputObject = {};
  outputObject.query = responseDataObject.query || '';
  outputObject.entries = responseDataObject.entries || [];
  return outputObject;
}
