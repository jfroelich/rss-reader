// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Sends a request to GoogleFeeds API to find urls of feeds matching
// a textual query. Calls back with an event object. Google formally deprecated
// this service. Around December 1st, 2015, I first noticed that the queries
// stopped working. However, I have witnessed the service occassionally work
// thereafter.
this.search_google_feeds = function(queryString, timeoutMillis, callback) {
  console.assert(queryString, 'queryString is required');
  console.assert(typeof timeoutMillis === 'undefined' ||
    (!isNaN(timeoutMillis) && timeoutMillis >= 0),
    'timeoutMillis %s is not a positive integer', timeoutMillis);

  const context = {
    'urlString': null,
    'callback': callback,
    'titleMaxLength': 200,
    'contentSnippetMaxLength': 400,
    'truncateReplacementString': '\u2026'
  };

  // Build the request url
  const baseURLString =
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const urlString = baseURLString + encodeURIComponent(queryString);
  console.debug('GET', urlString);
  context.urlString = urlString;

  const request = new XMLHttpRequest();
  if(timeoutMillis) {
    request.timeout = timeoutMillis;
  }
  const boundOnResponse = on_response.bind(request, context);
  request.onerror = boundOnResponse;
  request.ontimeout = boundOnResponse;
  request.onabort = boundOnResponse;
  request.onload = boundOnResponse;
  const isAsync = true;
  request.open('GET', urlString, isAsync);
  request.responseType = 'json';
  request.send();
};

function on_response(context, event) {
  // Assert that response is defined
  if(!event.target.response) {
    console.warn('Response undefined for GET', context.urlString);
    console.dir(event);
    context.callback({'type': 'UndefinedResponseError',
      'status': event.target.status});
    return;
  }

  // Check for a successful response
  if(event.type !== 'load') {
    console.warn('GET', context.urlString, event.type, event.target.status,
      event.target.response.responseDetails);
    callback({'type': event.type,
      'status': event.target.status,
      'message': event.target.response.responseDetails});
    return;
  }

  // Validate the response data
  const data = event.target.response.responseData;
  if(!data) {
    console.error('Undefined data for GET', context.urlString,
      event.target.response.responseDetails);
    callback({'type': 'UndefinedDataError',
      'message': event.target.response.responseDetails});
    return;
  }

  // Filter out various results
  // Always callback with an array, even an empty one
  const outputEntries = [];
  // Ensure that entries is defined
  const inputEntries = data.entries || [];
  const seenURLs = new Set();

  for(let entry of inputEntries) {
    // Filter results without a url
    if(!entry.url) {
      continue;
    }

    // Filter results without a valid url
    let entryURL = null;
    try {
      entryURL = new URL(entry.url);
    } catch(urlParseError) {
      continue;
    }

    // Filter results with an identical normalized url
    if(seenURLs.has(entryURL.href)) {
      continue;
    }
    seenURLs.add(entryURL.href);

    // Store a url object in place of a string
    entry.url = entryURL;

    // Sanitize the result title
    if(entry.title) {
      entry.title = filter_control_chars(entry.title);
      entry.title = replace_html(entry.title, '');
      entry.title = truncate_html(entry.title,
        context.titleMaxLength);
    }

    // Sanitize the result snippet
    if(entry.contentSnippet) {
      entry.contentSnippet = filter_control_chars(
        entry.contentSnippet);
      entry.contentSnippet = entry.contentSnippet.replace(/<br\s*>/gi, ' ');
      entry.contentSnippet = truncate_html(entry.contentSnippet,
        context.contentSnippetMaxLength, context.truncateReplacementString);
    }

    outputEntries.push(entry);
  }

  context.callback({
    'type': 'success',
    'query': data.query || '',
    'entries': outputEntries
  });
}

} // End file block scope
