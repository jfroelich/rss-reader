// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const GoogleFeeds = {};

{ // BEGIN LEXICAL SCOPE

const BASE_URL = 
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

function findFeed(query, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = findFeedOnload.bind(request, callback);
  const url = BASE_URL + encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
}

function findFeedOnload(callback, event) {
  const data = event.target.response.responseData;
  const query = data.query || '';
  let entries = data.entries || [];

  // Remove entries without a url
  entries = entries.filter(function(entry) {
    return entry.url;
  });

  // Remove duplicates
  entries = [...new Map(entries.map(function(entry) {
    return [entry.url, entry];
  })).values()];

  // Sanitize and continue
  entries.forEach(sanitizeEntry);
  callback(null, query, entries);
}

function sanitizeEntry(entry) {
  const removeTags = StringUtils.removeTags;
  const truncate = StringUtils.truncate;

  if(entry.title) {
    entry.title = removeTags(entry.title);
    entry.title = truncate(entry.title, 100);
  }

  if(entry.contentSnippet) {
    entry.contentSnippet = replaceBreaks(entry.contentSnippet);
    entry.contentSnippet = truncate(entry.contentSnippet, 400);
  }
}

function replaceBreaks(value) {
  return value.replace(/<\s*br\s*>/gi, '');
}

// Export into the global scope
GoogleFeeds.findFeed = findFeed;

} // END LEXICAL SCOPE
