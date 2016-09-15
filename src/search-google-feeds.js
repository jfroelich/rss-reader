// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: use new Fetch api

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
    'seen': {},
    'titleMaxLength': 200,
    'snippetMaxLength': 400,
    'replacement': ellipsis
  };

  const urlString = baseURLString + encodeURIComponent(query);
  context.urlString = urlString;

  console.debug('GET', urlString);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.onerror = onRequestError.bind(context);
  request.ontimeout = onRequestTimeout.bind(context);
  request.onabort = onRequestAbort.bind(context);
  request.onload = onRequestLoad.bind(context);
  request.open('GET', urlString, isAsync);
  request.responseType = 'json';
  request.send();
}

function onRequestLoad(event) {
  const response = event.target.response;
  if(!response) {
    console.error('Response undefined');
    this.callback({'type': 'UndefinedResponseError'});
    return;
  }

  const data = response.responseData;
  if(!data) {
    console.error('Missing response data');
    this.callback({'type': 'UndefinedDataError'});
    return;
  }

  let entries = data.entries || [];
  entries = entries.filter(entryHasURL);
  entries = entries.filter(setAndParseURL);
  entries = entries.filter(isEntryUnique, this);
  entries = entries.map(sanitizeTitle, this);
  entries = entries.map(sanitizeSnippet, this);

  const query = data.query || '';
  this.callback({'type': 'success', 'query': query, 'entries': entries});
}

function onRequestError(event) {
  console.warn('Request error', this.urlString);
  const outputEvent = {};
  outputEvent.type = event.type;
  outputEvent.status = event.target.status;
  if(event.target.response) {
    outputEvent.message = event.target.response.responseDetails;
  }

  this.callback(outputEvent);
}

function onRequestAbort(event) {
  console.warn('Aborted request', this.urlString);
  this.callback({'type': event.type});
}

function onRequestTimeout(event) {
  console.warn('Request timed out', this.urlString);
  this.callback({'type': event.type});
}

function entryHasURL(entry) {
  return entry.url;
}

function setAndParseURL(entry) {
  try {
    entry.url = new URL(entry.url);
    return true;
  } catch(error) {
    return false;
  }
}

function isEntryUnique(entry) {
  if(entry.url.href in this.seen) {
    return false;
  }

  this.seen[entry.url.href] = 1;
  return true;
}

function sanitizeTitle(entry) {
  if(entry.title) {
    let title = entry.title;
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = truncateHTML(title, this.titleMaxLength);
    entry.title = title;
  }
  return entry;
}

function replaceBRs(inputString) {
  return inputString.replace(/<br\s*>/gi, ' ');
}

function sanitizeSnippet(entry) {
  if(entry.contentSnippet) {
    let snippet = entry.contentSnippet;
    snippet = filterControlCharacters(snippet);
    snippet = replaceBRs(snippet);
    snippet = truncateHTML(snippet, this.snippetMaxLength, this.replacement);
    entry.contentSnippet = snippet;
  }
  return entry;
}

this.searchGoogleFeeds = searchGoogleFeeds;

} // End file block scope
