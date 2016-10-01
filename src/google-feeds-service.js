// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Provides simple access to some of Google's Feed APIs
function GoogleFeedsService() {
  this.verbose = false;
  this.replacement = '\u2026';
  this.titleMaxLength = 200;
  this.snippetMaxLength = 400;
  this.filterControlChars = rdr.utils.filterControlChars;
  this.replaceTags = rdr.html.replaceTags;
  this.truncate = rdr.html.truncate;

  this.fetchOptions = {
    'credentials': 'omit',
    'method': 'GET',
    'headers': {'Accept': 'application/json'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };
}

// Sends a query to google to find feeds that match the query, then calls
// back with matches
GoogleFeedsService.prototype.search = function(query, callback) {
  if(typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }

  const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const url = base + encodeURIComponent(query);
  if(this.verbose) {
    console.log('GET', url);
  }

  fetch(url, this.fetchOptions).then(this.onFetch.bind(this, callback)).catch(
    this.onFetchError.bind(this, callback));
};

GoogleFeedsService.prototype.onFetch = function(callback, response) {
  if(!response.ok) {
    if(this.verbose) {
      console.log('Response status:', response.responseStatus);
      console.log('Response details:', response.responseDetails);
      console.dir(response);
    }

    callback({'type': 'error'});
    return;
  }

  response.text().then(this.onReadText.bind(this, callback));
};

GoogleFeedsService.prototype.onFetchError = function(callback, error) {
  if(this.verbose) {
    console.error(error);
  }
  callback({'type': 'error'});
};

GoogleFeedsService.prototype.onReadText = function(callback, text) {
  let result = null;
  try {
    result = JSON.parse(text);
  } catch(error) {
    if(this.verbose) {
      console.error(error);
    }
    callback({'type': 'error'});
    return;
  }

  const data = result.responseData;
  if(!data) {
    if(this.verbose) {
      console.error('Missing response data');
    }
    callback({'type': 'error'});
    return;
  }

  const query = data.query || '';
  let entries = data.entries || [];
  entries = this.filterEntriesWithoutURLs(entries);
  this.parseEntryURLs(entries);
  // Filter again to catch parse failures
  entries = this.filterEntriesWithoutURLs(entries);
  entries = this.filterDups(entries);
  // Note: not sure why I have to rebind, I suppose map overwrites
  entries.forEach(this.sanitizeTitle, this);
  entries.forEach(this.sanitizeSnippet, this);
  callback({'type': 'success', 'query': query, 'entries': entries});
};

GoogleFeedsService.prototype.filterEntriesWithoutURLs = function(entries) {
  const output = [];
  for(let entry of entries) {
    if(entry.url) {
      output.push(entry);
    }
  }
  return output;
};

GoogleFeedsService.prototype.parseEntryURLs = function(entries) {
  for(let entry of entries) {
    try {
      entry.url = new URL(entry.url);
    } catch(error) {}
  }
};

GoogleFeedsService.prototype.filterDups = function(entries) {
  const output = [], seen = [];
  for(let entry of entries) {
    if(!seen.includes(entry.url.href)) {
      seen.push(entry.url.href);
      output.push(entry);
    }
  }
  return output;
};

GoogleFeedsService.prototype.sanitizeTitle = function(entry) {
  let title = entry.title || '';
  title = this.filterControlChars(title);
  title = this.replaceTags(title, '');
  title = this.truncate(title, this.titleMaxLength);
  entry.title = title;
};

GoogleFeedsService.prototype.sanitizeSnippet = function(entry) {
  let snippet = entry.contentSnippet || '';
  snippet = this.filterControlChars(snippet);
  snippet = this.replaceBRs(snippet);
  snippet = this.truncate(snippet, this.snippetMaxLength, this.replacement);
  entry.contentSnippet = snippet;
};

GoogleFeedsService.prototype.replaceBRs = function(str) {
  return str.replace(/<br\s*>/gi, ' ');
};
