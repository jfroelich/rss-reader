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
    'url_str': null,
    'callback': callback,
    'title_max_len': 200,
    'snippet_max_len': 400,
    'replacement_str': ELLIPSIS
  };


  const url_str = BASE_URL_STRING + encodeURIComponent(query);
  console.debug('GET', url_str);
  context.url_str = url_str;

  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = timeout_ms;
  const bound_on_response = on_response.bind(request, context);
  request.onerror = bound_on_response;
  request.ontimeout = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', url_str, async_flag);
  request.responseType = 'json';
  request.send();
};

function on_undefined_response(context, event) {
  console.warn('Response undefined for GET', context.url_str);
  console.dir(event);
  context.callback({
    'type': 'UndefinedResponseError',
    'status': event.target.status
  });
}

function on_non_load(context, event) {
  console.warn('GET', context.url_str, event.type, event.target.status,
    event.target.response.responseDetails);
  callback({'type': event.type,
    'status': event.target.status,
    'message': event.target.response.responseDetails});
}

function on_data_undefined(context, event) {
  console.error('Undefined data for GET', context.url_str,
    event.target.response.responseDetails);
  callback({'type': 'UndefinedDataError',
    'message': event.target.response.responseDetails});
}

function entry_has_url(entry) {
  return entry.url;
}

function deserialize_entry_url(entry) {
  try {
    entry.url = new URL(entry.url);
    return true;
  } catch(error) {
    return false;
  }
}

function is_entry_unique(seen, entry) {
  if(entry.url.href in seen) {
    return false;
  }

  seen[entry.url.href] = 1;
  return true;
}

function sanitize_entry_title(context, entry) {
  // Sanitize the result title
  if(entry.title) {
    entry.title = filter_control_chars(entry.title);
    entry.title = replace_html(entry.title, '');
    entry.title = truncate_html(entry.title,
      context.title_max_len);
  }
  return entry;
}

function sanitize_entry_snippet(context, entry) {
  if(entry.contentSnippet) {
    entry.contentSnippet = filter_control_chars(entry.contentSnippet);
    entry.contentSnippet = entry.contentSnippet.replace(/<br\s*>/gi, ' ');
    entry.contentSnippet = truncate_html(entry.contentSnippet,
      context.snippet_max_len, context.replacement_str);
  }
  return entry;
}

function on_response(context, event) {
  if(!event.target.response) {
    on_undefined_response(context, event);
    return;
  }

  if(event.type !== 'load') {
    on_non_load(context, event);
    return;
  }

  const data = event.target.response.responseData;
  if(!data) {
    on_data_undefined(context, event);
    return;
  }

  const seen = {};
  let entries = data.entries || [];
  entries = entries.filter(entry_has_url);
  entries = entries.filter(deserialize_entry_url);
  entries = entries.filter(is_entry_unique.bind(null, seen));
  entries = entries.map(sanitize_entry_title.bind(null, context));
  entries = entries.map(sanitize_entry_snippet.bind(null, context));

  context.callback({
    'type': 'success',
    'query': data.query || '',
    'entries': entries
  });
}

} // End file block scope
