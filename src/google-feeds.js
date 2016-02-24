// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

// NOTE: Google formally deprecated this service. Around December 1st, 2015, I
// first noticed that the queries stopped working. However, I have witnessed
// the service occassionally work thereafter.
// TODO: the truncation of html in a result's content snippet is arbitrary with
// respect to tags and could lead to truncating in the middle of a tag, or
// leave unclosed tags in the result. Think about how to
// prevent these issues.

const GoogleFeeds = {};

GoogleFeeds.BASE_URL =
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

GoogleFeeds.CONTENT_SNIPPET_MAX_LENGTH = 400;

// Sends an async request to Google to search for feeds that correspond to
// a general text query. Passes the results to the callback. The callback
// is passed an error argument, the query argument (as modified by Google),
// and an array of results. The error argument is only defined if an error
// occurred. If an error occurred, the other arguments may be undefined or null.
// The results array contains result objects called entries. Each entry is a
// basic js object containing the string properties url, link, title, and
// contentSnippet. The title and content snippet may contain basic HTML such as
// <b></b> around terms that were present in the query.
GoogleFeeds.search = function(query, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = GoogleFeeds.onSearchResponse.bind(request, callback);
  const url = GoogleFeeds.BASE_URL + encodeURIComponent(query);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
};

GoogleFeeds.onSearchResponse = function(callback, event) {
  'use strict';
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
  entries = GoogleFeeds.removeEntriesWithoutURLs(entries);
  entries = GoogleFeeds.removeDuplicateEntriesByURL(entries);
  entries.forEach(GoogleFeeds.sanitizeEntry);
  callback(null, query, entries);
};

GoogleFeeds.removeEntriesWithoutURLs = function(entriesArray) {
  'use strict';
  return entriesArray.filter(function getEntryURL(entry) {
    return entry.url;
  });
};

GoogleFeeds.removeDuplicateEntriesByURL = function(entriesArray) {
  'use strict';
  const expandedEntries = entriesArray.map(function expand(entry) {
    return [entry.url, entry];
  });
  const entriesAggregatedByURL = new Map(expandedEntries);
  const aggregateValues = entriesAggregatedByURL.values();
  return Array.from(aggregateValues);
};

GoogleFeeds.sanitizeEntry = function(entry) {
  'use strict';
  if(entry.title) {
    entry.title = utils.replaceHTML(entry.title);
    entry.title = utils.truncateString(entry.title, 100);
  }

  if(entry.contentSnippet) {
    entry.contentSnippet = entry.contentSnippet.replace(/<\s*br\s*>/gi, ' ');
    entry.contentSnippet = utils.truncateString(entry.contentSnippet,
      GoogleFeeds.CONTENT_SNIPPET_MAX_LENGTH);
  }
};
