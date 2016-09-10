// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: switch to using fetch API
// TODO: use separate response event handlers

const ellipsis = '\u2026';

const baseURLString =
  'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';

// Sends a request to GoogleFeeds API to find urls of feeds matching
// a textual query. Calls back with an event object. Google formally deprecated
// this service. Around December 1st, 2015, I first noticed that the queries
// stopped working. However, I have witnessed the service occassionally work
// thereafter.
// @param query {String}
// @param timeoutMs {integer}
// @param callback {function}
function searchGoogleFeeds(query, timeoutMs, callback) {
  console.assert(query);

  if(timeoutMs) {
    console.assert(!isNaN(timeoutMs));
    console.assert(timeoutMs >= 0);
  }

  const context = {
    'urlString': null,
    'callback': callback,
    'titleMaxLength': 200,
    'snippetMaxLength': 400,
    'replacementString': ellipsis
  };

  const urlString = baseURLString + encodeURIComponent(query);
  context.urlString = urlString;

  console.debug('GET', urlString);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  const boundOnResponse = onResponse.bind(request, context);
  request.onerror = boundOnResponse;
  request.ontimeout = boundOnResponse;
  request.onabort = boundOnResponse;
  request.onload = boundOnResponse;
  request.open('GET', urlString, isAsync);
  request.responseType = 'json';
  request.send();
}

function onUndefinedResponse(context, event) {
  console.warn('Response undefined for GET', context.urlString);
  console.dir(event);
  context.callback({
    'type': 'UndefinedResponseError',
    'status': event.target.status
  });
}

function onNonLoad(context, event) {
  console.warn('GET', context.urlString, event.type, event.target.status,
    event.target.response.responseDetails);
  callback({'type': event.type,
    'status': event.target.status,
    'message': event.target.response.responseDetails});
}

function onResponseDataUndefined(context, event) {
  console.error('Undefined data for GET', context.urlString,
    event.target.response.responseDetails);
  callback({'type': 'UndefinedDataError',
    'message': event.target.response.responseDetails});
}

function entryHasURL(entry) {
  return entry.url;
}

function deserializeEntryURL(entry) {
  try {
    entry.url = new URL(entry.url);
    return true;
  } catch(error) {
    return false;
  }
}

function isEntryUnique(seen, entry) {
  if(entry.url.href in seen) {
    return false;
  }

  seen[entry.url.href] = 1;
  return true;
}

function sanitizeEntryTitle(context, entry) {
  // Sanitize the result title
  if(entry.title) {
    entry.title = filterControlCharacters(entry.title);
    entry.title = replaceHTML(entry.title, '');
    entry.title = truncateHTML(entry.title,
      context.titleMaxLength);
  }
  return entry;
}

function replaceBRElements(inputString) {
  return inputString.replace(/<br\s*>/gi, ' ');
}

function sanitizeEntrySnippet(context, entry) {
  if(entry.contentSnippet) {
    entry.contentSnippet = filterControlCharacters(entry.contentSnippet);
    entry.contentSnippet = replaceBRElements(entry.contentSnippet);
    entry.contentSnippet = truncateHTML(entry.contentSnippet,
      context.snippetMaxLength, context.replacementString);
  }
  return entry;
}

function onResponse(context, event) {
  if(!event.target.response) {
    onUndefinedResponse(context, event);
    return;
  }

  if(event.type !== 'load') {
    onNonLoad(context, event);
    return;
  }

  const data = event.target.response.responseData;
  if(!data) {
    onResponseDataUndefined(context, event);
    return;
  }

  const seen = {};
  let entries = data.entries || [];
  entries = entries.filter(entryHasURL);
  entries = entries.filter(deserializeEntryURL);
  entries = entries.filter(isEntryUnique.bind(null, seen));
  entries = entries.map(sanitizeEntryTitle.bind(null, context));
  entries = entries.map(sanitizeEntrySnippet.bind(null, context));

  context.callback({
    'type': 'success',
    'query': data.query || '',
    'entries': entries
  });
}

this.searchGoogleFeeds = this.searchGoogleFeeds;

} // End file block scope
