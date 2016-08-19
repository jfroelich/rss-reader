// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const ELLIPSIS = '\u2026';

const BASE_URL_STRING =
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

// Sends a request to GoogleFeeds API to find urls of feeds matching
// a textual query. Calls back with an event object. Google formally deprecated
// this service. Around December 1st, 2015, I first noticed that the queries
// stopped working. However, I have witnessed the service occassionally work
// thereafter.
// @param query {String}
// @param timeout_ms {integer}
// @param callback {function}
this.search_google_feeds = function(query, timeout_ms, callback) {
  console.assert(query);
  console.assert(typeof timeout_ms === 'undefined' ||
    (!isNaN(timeout_ms) && timeout_ms >= 0));

  const context = {
    'urlString': null,
    'callback': callback,
    'titleMaxLength': 200,
    'contentSnippetMaxLength': 400,
    'truncateReplacementString': ELLIPSIS
  };


  const urlString = BASE_URL_STRING + encodeURIComponent(query);
  console.debug('GET', urlString);
  context.urlString = urlString;

  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = timeout_ms;
  const bound_on_response = on_response.bind(request, context);
  request.onerror = bound_on_response;
  request.ontimeout = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', urlString, async_flag);
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
  const output_entries = [];
  // Ensure that entries is defined
  const input_entries = data.entries || [];
  const seen_urls = new Set();

  for(let entry of input_entries) {
    // Filter results without a url
    if(!entry.url) {
      continue;
    }

    // Filter results without a valid url
    let entry_url = null;
    try {
      entry_url = new URL(entry.url);
    } catch(error) {
      continue;
    }

    // Filter results with an identical normalized url
    if(seen_urls.has(entry_url.href)) {
      continue;
    }
    seen_urls.add(entry_url.href);

    // Store a url object in place of a string
    entry.url = entry_url;

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

    output_entries.push(entry);
  }

  context.callback({
    'type': 'success',
    'query': data.query || '',
    'entries': output_entries
  });
}

} // End file block scope
