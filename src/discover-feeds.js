// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.feed = lucu.feed || {};

// Fetches an array of search results and passes them to onComplete.
lucu.feed.discover = function(query, onComplete, onError, timeout) {
  return lucu.feed.queryGoogleFeeds_(query, timeout, onComplete, onError);
};

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
lucu.feed.queryGoogleFeeds_ = function(query, timeout, onComplete, onError) {

  query = (query || '').trim();
  onError = onError || lucu.functionUtils.noop;

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onError;
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = lucu.feed.onGoogleResultsReceived_.bind(request, onComplete);

  var baseURL = 'https://ajax.googleapis.com/ajax/services/feed/find';
  var apiVersion = '1.0';
  var requestURL = baseURL + '?v=' + apiVersion + '&q=' +
    encodeURIComponent(query);

  request.open('GET', requestURL, true);
  request.responseType = 'json';
  request.send();
};

lucu.feed.onGoogleResultsReceived_ = function(onComplete) {
  // Expects this instanceof XMLHttpRequest
  var data = this.response.responseData;
  data.entries = data.entries || [];
  data.query = data.query || '';
  var sanitize = lucu.feed.sanitizeGoogleResultEntry_;
  var entries = data.entries.map(sanitize);
  onComplete(data.query, entries);
};

lucu.feed.sanitizeGoogleResultEntry_ = function(entry) {
  // TODO: this should be creating a modified clone, not mutating
  // in place as a side effect.

  entry.contentSnippet = lucu.string.stripBRs(entry.contentSnippet);
  return entry;
};
