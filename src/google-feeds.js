// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Accesses the basic find-feeds functionality of the Google Feeds API.
// Google formally deprecated this service. Around December 1st, 2015, I
// first noticed that the queries stopped working. However, I have witnessed
// the service occassionally work thereafter.
// Requires: /src/html.js
// Requires: /src/string.js

// Sends an async request to Google to search for feeds that correspond to
// a general text query. Passes the results to the callback. The callback
// is passed an error argument, the query argument (as modified by Google),
// and an array of results. The error argument is only defined if an error
// occurred. If an error occurred, the other arguments may be undefined or null.
// The results array contains result objects called entries. Each entry is a
// basic js object containing the string properties url, link, title, and
// contentSnippet. The title and content snippet may contain basic HTML such as
// <b></b> around terms that were present in the query.
function google_feeds_search(query, timeout, callback) {
  'use strict';

  const GOOGLE_FEEDS_BASE_URL =
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

  const url = GOOGLE_FEEDS_BASE_URL + encodeURIComponent(query);

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = google_feeds_on_response.bind(request, callback);
  request.open('GET', url, true);
  request.responseType = 'json';
  request.send();
}

// Cleans up the response data before sending it to the callback
function google_feeds_on_response(callback, event) {
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

  // There is no point to serving up an entry unless it has a URL to which
  // the user can subscribe.
  entries = google_feeds_filter_entries_without_urls(entries);

  // I have noticed that the search results occassionally contain multiple
  // hits for the same feed. Only retain the first.
  entries = google_feeds_filter_duplicate_entries(entries);

  // Clean up some of the formatting
  entries.forEach(google_feeds_sanitize_entry);

  // Callback with null to indicate to no error
  callback(null, query, entries);
}

function google_feeds_filter_entries_without_urls(entriesArray) {
  'use strict';
  return entriesArray.filter(google_feeds_get_entry_url);
};

function google_feeds_get_entry_url(entry) {
  'use strict';
  return entry.url;
}

function google_feeds_filter_duplicate_entries(entriesArray) {
  'use strict';
  const expandedEntries = entriesArray.map(function expand(entry) {
    return [entry.url, entry];
  });
  const entriesAggregatedByURL = new Map(expandedEntries);
  const aggregateValues = entriesAggregatedByURL.values();
  return Array.from(aggregateValues);
}

var GOOGLE_FEEDS_TITLE_MAX_LENGTH = 200;
var GOOGLE_FEEDS_CONTENT_SNIPPET_MAX_LENGTH = 400;

function google_feeds_sanitize_entry(entry) {
  'use strict';
  if(entry.title) {
    entry.title = string_filter_controls(entry.title);

    // I don't want any html formatting to remain in the title
    entry.title = html_replace(entry.title, '');

    entry.title = string_truncate(entry.title, GOOGLE_FEEDS_TITLE_MAX_LENGTH);
  }

  // Entry snipped may contain some html formatting, like <b> tags around
  // query terms. We want to retain that info, but remove some other info.

  if(entry.contentSnippet) {
    entry.contentSnippet = string_filter_controls(entry.contentSnippet);
    entry.contentSnippet = html_replace_breakrules(entry.contentSnippet);
    entry.contentSnippet = html_truncate(entry.contentSnippet,
      GOOGLE_FEEDS_CONTENT_SNIPPET_MAX_LENGTH, '...');
  }
}
