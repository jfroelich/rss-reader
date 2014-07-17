// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function discoverFeeds(params) {

  var onComplete = params.oncomplete;
  var onerror = params.onerror || noop;
  var query = (params.query || '').trim();
  var timeout = params.timeout;

  return queryGoogleFeeds(query, timeout, onComplete, onerror);
}

/**
 * Use Google's find feed service to find feed URLs corresponding to a
 * google search query.
 *
 * @param params {object} an object containing props:
 * - query {string} the text query to send to google, assumed defined
 * - oncomplete {function} the callback function to pass query and
 * entries, an array of entry objects from the Google JSON result
 * - onerror {function} the fallback function in case of an error
 * - timeout {integer} optional timeout before giving up, ms
 */
function queryGoogleFeeds(query, timeout, onComplete, onerror) {

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = onGoogleResultsReceived.bind(request, onComplete);


  var baseURL = 'https://ajax.googleapis.com/ajax/services/feed/find';
  var apiVersion = '1.0';
  var requestURL = baseURL + '?v=' + apiVersion + '&q=' +
    encodeURIComponent(query);

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
}

function onGoogleResultsReceived(onComplete) {
  var data = this.response.responseData;
  data.entries = data.entries || [];
  data.query = data.query || '';
  var entries = data.entries.map(sanitizeGoogleResultEntry);
  onComplete(data.query, entries);
}

function sanitizeGoogleResultEntry(entry) {
  // TODO: this should be creating a modified clone, not mutating
  // in place as a side effect.

  entry.contentSnippet = stripBRs(entry.contentSnippet);
  return entry;
}
