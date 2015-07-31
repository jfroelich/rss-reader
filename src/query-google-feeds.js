// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Sends a search query to Google and passes an array of results to the 
 * callback. Calls the fallback instead if an error occurs
 */
lucu.queryGoogleFeeds = function(query, timeout, callback, fallback) {
  'use strict';
  query = (query || '').trim();
  if(!query) return callback('',[]);
  fallback = fallback || function () {};
  var onload = lucu.handleGoogleFeedsResponse;
  var base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  var url = base + encodeURIComponent(query);
  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = fallback;
  request.ontimeout = fallback;
  request.onabort = fallback;
  request.onload = onload.bind(request, callback);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

// Handles the response to a Google Feeds query
// Expects 'this' to be bound to the XMLHttpRequest
lucu.handleGoogleFeedsResponse = function(callback) {
  'use strict';
  var data = this.response.responseData;
  var entries = (data.entries || '').map(lucu.sanitizeGoogleSnippet);
  callback(data.query || '', entries);
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
