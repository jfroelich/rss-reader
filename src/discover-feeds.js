// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Discover module for searching for feeds
 *
 */
(function(exports) {
'use strict';

/**
 * Use Google's find feed service to find feed URLs corresponding to a
 * google search query.
 *
 * TODO: document the props of a result object
 */
function queryGoogleFeeds(query, timeout, onComplete, onError) {

  if(!query) {
    return onComplete('',[]);
  }

  query = query.trim();

  if(!query) {
    return onComplete('',[]);
  }

  onError = onError || function noop() {};

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onError;
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = function () {
    var data = this.response.responseData;
    data.entries = data.entries || [];
    data.query = data.query || '';
    var entries = data.entries.map(sanitize);
    onComplete(data.query, entries);
  };
  request.open('GET', getURL(query), true);
  request.responseType = 'json';
  request.send();
}

function getURL(query) {
  return 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=' +
    encodeURIComponent(query);
}

// Strip <br> elements from snippet
function sanitize(entry) {
  var snippet = entry.contentSnippet;
  if(!snippet) return entry;
  entry.contentSnippet = snippet.replace(/<br>/gi,'');
  return entry;
}

exports.queryGoogleFeeds = queryGoogleFeeds;

}(lucu));
