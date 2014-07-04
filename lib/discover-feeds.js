// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
function discoverFeeds(params) {
  return queryGoogleFeeds(params);
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
function queryGoogleFeeds(params) {
  var oncomplete = params.oncomplete;
  var onerror = params.onerror || noop;
  var query = (params.query || '').trim();
  var timeout = params.timeout;

  var baseURL = 'https://ajax.googleapis.com/ajax/services/feed/find';
  var apiVersion = '1.0';
  var requestURL = baseURL + '?v=' + apiVersion + '&q=' + encodeURIComponent(query);

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;

  request.onload = function(event) {

    console.log('got %o from google feeds for query %s', this.response, query);

    var data = this.response.responseData;
    var formattedQuery = data.query || '';
    var entries = data.entries || [];

    // Preprocess content snippets
    entries.forEach(function(entry) {
      entry.contentSnippet = stripBRs(entry.contentSnippet);
    });

    oncomplete(formattedQuery, entries);
  };

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
}