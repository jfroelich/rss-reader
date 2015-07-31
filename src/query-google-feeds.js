// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Use Google's seach service to find feeds. Sends a search query to Google
 * and passes an array of results to the callback. Calls the fallback instead
 * if an error occurs (e.g. offline, 404, 503, content type).
 */
lucu.queryGoogleFeeds = function(query, timeout, callback, fallback) {
  'use strict';
  query = (query || '').trim();
  if(!query) return callback('',[]);
  fallback = fallback || function () {};

  var base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  var url = base + encodeURIComponent(query);
  var sanitize = lucu.sanitizeGoogleSnippet;

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = fallback;
  request.ontimeout = fallback;
  request.onabort = fallback;
  request.onload = function () {
    var data = this.response.responseData;
    data.entries = data.entries || [];
    data.query = data.query || '';
    var entries = data.entries.map(sanitize);
    callback(data.query, entries);
  };
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

// Modifies the given input entry (and also returns it)
lucu.sanitizeGoogleSnippet = function(entry) {
  'use strict';
  var snippet = entry.contentSnippet;
  if(snippet) {
    entry.contentSnippet = snippet.replace(/<br>/gi,'');
  }
  return entry;
};
