// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function searchGoogleFeeds(query, timeout, callback) {
  'use strict';
  const BASE_URL = 
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;

  request.onload = function(event) {
    const data = event.target.response.responseData;
    let responseQuery = data.query || '';
    let entries = data.entries || [];
    entries = entries.filter(hasURL);
    entries.forEach(sanitizeEntry);
    callback(null, responseQuery, entries);
  };

  const url = BASE_URL + encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();

  function hasURL(entry) {
    return entry.url;
  }

  function sanitizeEntry(entry) {
    if(!entry) {
      return;
    }

    if(entry.title) {
      entry.title = stripTags(entry.title);
      entry.title = truncate(entry.title, 100);
    }

    if(entry.contentSnippet) {
      const BREAK_RULE = /<br>/gi;
      entry.contentSnippet = entry.contentSnippet.replace(BREAK_RULE, '');
      // NOTE: this can lead to display bugs because the arbitrary cut off 
      // can cut tags in half
      entry.contentSnippet = truncate(entry.contentSnippet, 400);
    }

    return entry;
  }
}
