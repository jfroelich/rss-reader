// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Google Feed Service lib
lucu.gfs = {};

lucu.gfs.BASE_URL = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

/**
 * Sends a search query to Google and passes an array of results to the 
 * callback. Calls the fallback instead if an error occurs
 */
lucu.gfs.query = function(query, timeout, callback, fallback) {
  'use strict';
  
  query = (query || '').trim();
  if(!query) {
    callback('',[]);
    return;
  }

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = fallback;
  request.ontimeout = fallback;
  request.onabort = fallback;
  request.onload = lucu.gfs.onload.bind(request, callback);

  const url = lucu.gfs.BASE_URL + encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

lucu.gfs.onload = function(callback, event) {
  'use strict';

  const request = event.target;
  const response = request.response;
  const data = response.responseData;
  const query = data.query || '';
  const entries = data.entries || [];

  // Preprocess entries
  entries.forEach(lucu.gfs.sanitizeSnippet);

  callback(query, entries);
};

// Modifies entry.contentSnippet
lucu.gfs.sanitizeSnippet = function(entry) {
  'use strict';

  // TODO: set in external context?
  const BREAK_RULE = /<br>/gi;

  if(entry && entry.contentSnippet) {
    entry.contentSnippet = entry.contentSnippet.replace(BREAK_RULE, '');
  }

  // Superfluous but harmless
  return entry;
};
