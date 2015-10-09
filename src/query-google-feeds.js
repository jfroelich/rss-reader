// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: use a second level object for namespace, maybe
// something like lucu.gfa (google feeds API)

/**
 * Sends a search query to Google and passes an array of results to the 
 * callback. Calls the fallback instead if an error occurs
 */
lucu.queryGoogleFeeds = function(query, timeout, callback, fallback) {
  'use strict';
  
  query = (query || '').trim();
  if(!query) {
    callback('',[]);
    return;
  }

  // NOTE: disabled temporarily, I don't think there is a need to ensure
  // it is defined, it is ok to set request props to undefined
  //function noop() {}
  //fallback = fallback || noop;
  
  const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const url = base + encodeURIComponent(query);
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = fallback;
  request.ontimeout = fallback;
  request.onabort = fallback;
  request.onload = lucu.handleGoogleFeedsResponse.bind(request, callback);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

lucu.handleGoogleFeedsResponse = function(callback, event) {
  'use strict';

  const request = event.target;
  const response = request.response;
  const data = response.responseData;
  const query = data.query || '';
  const entries = data.entries || [];

  // Preprocess entries
  entries.forEach(lucu.sanitizeGoogleSnippet);

  callback(query, entries);
};

// Modifies entry.contentSnippet
lucu.sanitizeGoogleSnippet = function(entry) {
  'use strict';

  // TODO: set in external context?
  const BREAK_RULE = /<br>/gi;

  if(entry && entry.contentSnippet) {
    entry.contentSnippet = entry.contentSnippet.replace(BREAK_RULE, '');
  }

  // Superfluous but harmless
  return entry;
};
