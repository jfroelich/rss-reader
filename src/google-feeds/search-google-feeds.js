// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: replace-breakrules-in-string.js
// Requires: replaceHTML
// Requires: truncateString

// NOTE: Google formally deprecated this service. Around December 1st, 2015, I
// first noticed that the queries stopped working. However, I have witnessed
// the service occassionally work thereafter.
// TODO: the truncation of html in a result's content snippet is arbitrary with
// respect to tags and could lead to truncating in the middle of a tag, or
// leave unclosed tags in the result. Think about how to
// prevent these issues.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// The url of Google's find feed service.
const BASE_URL =
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

// Sends an async request to Google to search for feeds that correspond to
// a general text query. Passes the results to the callback. The callback
// is passed an error argument, the query argument (as modified by Google),
// and an array of results. The error argument is only defined if an error
// occurred. If an error occurred, the other arguments may be undefined or null.
// The results array contains result objects called entries. Each entry is a
// basic js object containing the string properties url, link, title, and
// contentSnippet. The title and content snippet may contain basic HTML such as
// <b></b> around terms that were present in the query.
function searchGoogleFeeds(query, timeout, callback) {
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

// Export a global
this.searchGoogleFeeds = searchGoogleFeeds;

// Cleans up the search results and passes them along
// to the callback
function findFeedOnload(callback, event) {
  const request = event.target;
  const response = request.response;
  const data = response.responseData;

  if(!data) {
    console.debug(response.responseDetails);
    callback(response.responseDetails, null, null);
    return;
  }

  const query = data.query || '';
  let entries = data.entries || [];

  entries = entries.filter(getEntryURL);

  // Remove duplicates
  entries = Array.from(new Map(entries.map(expandEntry)).values());

  entries.forEach(sanitizeEntry);
  callback(null, query, entries);
}

function expandEntry(entry) {
  return [entry.url, entry];
}

function getEntryURL(entry) {
  return entry.url;
}

function sanitizeEntry(entry) {
  if(entry.title) {
    entry.title = replaceHTML(entry.title);
    entry.title = truncateString(entry.title, 100);
  }

  if(entry.contentSnippet) {
    entry.contentSnippet = replaceBreakrulesInString(entry.contentSnippet);
    entry.contentSnippet = truncateString(entry.contentSnippet, 400);
  }
}

} // END ANONYMOUS NAMESPACE
