// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: use new Fetch api
// TODO: do favicon handling here so reduce caller burden, maybe have a boolean
// parameter on whether to do it
// TODO: maybe add a verbose parameter

var rdr = rdr || {};
rdr.googleFeeds = {};

rdr.googleFeeds.ellipsis = '\u2026';

// Sends a request to GoogleFeeds API to find urls of feeds matching
// a textual query. Calls back with an event object. Google formally deprecated
// this service in 2015, but sometimes it works.
// @param query {String}
// @param timeoutMs {integer}
// @param callback {function}
rdr.googleFeeds.search = function(query, timeoutMs, callback) {

  // Worth guarding so as to avoid a pointless network call
  if(!rdr.googleFeeds.isValidQuery(query)) {
    throw new Error('query must be a string');
  }

  if(timeoutMs) {
    console.assert(!isNaN(timeoutMs));
    console.assert(isFinite(timeoutMs));
    console.assert(timeoutMs >= 0);
  }

  const context = {
    'callback': callback,
    'titleMaxLength': 200,
    'snippetMaxLength': 400,
    'replacement': rdr.googleFeeds.ellipsis
  };

  const urlString = rdr.googleFeeds.buildRequestURL(query);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.onerror = rdr.googleFeeds._onError.bind(context);
  request.ontimeout = rdr.googleFeeds._onTimeout.bind(context);
  request.onabort = rdr.googleFeeds._onAbort.bind(context);
  request.onload = rdr.googleFeeds._onLoad.bind(context);
  request.open('GET', urlString, isAsync);
  request.responseType = 'json';
  request.send();
};

rdr.googleFeeds.isValidQuery = function(query) {
  return query && typeof query === 'string';
};

rdr.googleFeeds.baseURLString = 'https://ajax.googleapis.com/ajax/services/' +
  'feed/find?v=1.0&q=';
rdr.googleFeeds.buildRequestURL = function(query) {
  return rdr.googleFeeds.baseURLString + encodeURIComponent(query);
};

rdr.googleFeeds._onLoad = function(event) {
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
  entries = entries.filter(rdr.googleFeeds.entryHasURL);
  entries = entries.filter(rdr.googleFeeds.setEntryURL);
  entries = rdr.googleFeeds.filterDups(entries);
  entries = entries.map(rdr.googleFeeds.sanitizeTitle, this);
  entries = entries.map(rdr.googleFeeds.sanitizeSnippet, this);

  const query = data.query || '';
  this.callback({'type': 'success', 'query': query, 'entries': entries});
};

rdr.googleFeeds._onError = function(event) {
  const outputEvent = {};
  outputEvent.type = event.type;
  outputEvent.status = event.target.status;
  if(event.target.response) {
    outputEvent.message = event.target.response.responseDetails;
  }

  this.callback(outputEvent);
};

rdr.googleFeeds._onAbort = function(event) {
  this.callback({'type': event.type});
};

rdr.googleFeeds._onTimeout = function(event) {
  this.callback({'type': event.type});
};

rdr.googleFeeds.entryHasURL = function(entry) {
  return entry.url;
};

rdr.googleFeeds.setEntryURL = function(entry) {
  try {
    entry.url = new URL(entry.url);
    return true;
  } catch(error) {
    return false;
  }
};

rdr.googleFeeds.filterDups = function(entries) {
  const outputEntries = [];
  const seenURLs = [];
  for(let entry of entries) {
    if(!seenURLs.includes(entry.url.href)) {
      seenURLs.push(entry.url.href);
      outputEntries.push(entry);
    }
  }
  return outputEntries;
};

rdr.googleFeeds.sanitizeTitle = function(entry) {
  if(entry.title) {
    let title = entry.title;
    title = rdr.utils.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = rdr.html.truncate(title, this.titleMaxLength);
    entry.title = title;
  }
  return entry;
};

rdr.googleFeeds.replaceBRs = function(inputString) {
  return inputString.replace(/<br\s*>/gi, ' ');
};

rdr.googleFeeds.sanitizeSnippet = function(entry) {
  if(entry.contentSnippet) {
    let snippet = entry.contentSnippet;
    snippet = rdr.utils.filterControlChars(snippet);
    snippet = rdr.googleFeeds.replaceBRs(snippet);
    snippet = rdr.html.truncate(snippet, this.snippetMaxLength,
      this.replacement);
    entry.contentSnippet = snippet;
  }
  return entry;
};
