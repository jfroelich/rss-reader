// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for using the Google Feeds API
const GoogleFeeds = {};

{ // BEGIN ANONYMOUS NAMESPACE

// The url of Google's find feed service.
const BASE_URL = 
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

// Sends a request to Google to search for feeds that correspond to 
// a general text query. Passes the results to the callback.
GoogleFeeds.findFeed = function(query, timeout, callback) {
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
};

// Cleans up the search results and passes them along
// to the callback
// Private helper for findFeed
function findFeedOnload(callback, event) {
  const data = event.target.response.responseData;
  const query = data.query || '';
  let entries = data.entries || [];

  entries = entries.filter(getEntryURL);

  // Remove duplicates
  entries = [...new Map(entries.map(function(entry) {
    return [entry.url, entry];
  })).values()];

  entries.forEach(sanitizeEntry);
  callback(null, query, entries);
}

// Returns the url property value of an entry
// Private helper for onload
function getEntryURL(entry) {
  return entry.url;
}

// Cleans up some properties of an entry object
// Private helper for onload
function sanitizeEntry(entry) {
  if(entry.title) {
    entry.title = StringUtils.removeTags(entry.title);
    entry.title = StringUtils.truncate(entry.title, 100);
  }

  if(entry.contentSnippet) {
    entry.contentSnippet = replaceBreaks(entry.contentSnippet);
    // TODO: the truncation is arbitrary with respect to tags
    // and could lead to truncating in the middle of a tag, or
    // leave unclosed tags in the result. Think about how to 
    // prevent these two issues.
    entry.contentSnippet = StringUtils.truncate(
      entry.contentSnippet, 400);
  }
}

// Removes <br> elements from a string
// Private helper for sanitize.
function replaceBreaks(value) {
  return value.replace(/<\s*br\s*>/gi, ' ');
}

} // END ANONYMOUS NAMESPACE
