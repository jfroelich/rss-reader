// See license.md

'use strict';

{

function searchGoogleFeeds(query, verbose, callback) {

  if(typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }

  const log = new LoggingService();
  log.enabled = verbose;

  const ctx = {};
  ctx.log = log;
  ctx.replacement = '\u2026';
  ctx.titleMaxLength = 200;
  ctx.snippetMaxLength = 400;
  ctx.callback = callback;

  const opts = {
    'credentials': 'omit',
    'method': 'GET',
    'headers': {'Accept': 'application/json'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const base = 'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const url = base + encodeURIComponent(query);
  log.log('GET', url);
  fetch(url, opts).then(onFetch.bind(ctx)).catch(onFetchError.bind(ctx));
}

function onFetch(response) {
  if(!response.ok) {
    this.log.log('Response status:', response.responseStatus);
    this.log.log('Response details:', response.responseDetails);
    this.callback({'type': 'error'});
    return;
  }

  response.text().then(onReadText.bind(this));
}

function onFetchError(error) {
  this.log.error(error);
  this.callback({'type': 'error'});
}

function onReadText(text) {
  let result = null;
  try {
    result = JSON.parse(text);
  } catch(error) {
    this.log.error(error);
    this.callback({'type': 'error'});
    return;
  }

  const data = result.responseData;
  if(!data) {
    this.log.error('Missing response data');
    this.callback({'type': 'error'});
    return;
  }

  const query = data.query || '';
  let entries = data.entries || [];
  entries = filterEntriesWithoutURLs(entries);
  parseEntryURLs(entries);
  // Filter again to catch parse failures
  entries = filterEntriesWithoutURLs(entries);
  entries = filterDups(entries);

  entries.forEach(sanitizeTitle, this);
  entries.forEach(sanitizeSnippet, this);
  this.callback({'type': 'success', 'query': query, 'entries': entries});
};

function filterEntriesWithoutURLs(entries) {
  const output = [];
  for(let entry of entries) {
    if(entry.url) {
      output.push(entry);
    }
  }
  return output;
}

function parseEntryURLs(entries) {
  for(let entry of entries) {
    try {
      entry.url = new URL(entry.url);
    } catch(error) {}
  }
}

function filterDups(entries) {
  const output = [], seen = [];
  for(let entry of entries) {
    if(!seen.includes(entry.url.href)) {
      seen.push(entry.url.href);
      output.push(entry);
    }
  }
  return output;
}

function sanitizeTitle(entry) {
  let title = entry.title || '';
  title = ReaderUtils.filterControlChars(title);
  title = rdr.html.replaceTags(title, '');
  title = rdr.html.truncate(title, this.titleMaxLength);
  entry.title = title;
}

function sanitizeSnippet(entry) {
  let snippet = entry.contentSnippet || '';
  snippet = ReaderUtils.filterControlChars(snippet);
  snippet = replaceBRs(snippet);
  snippet = rdr.html.truncate(snippet, this.snippetMaxLength, this.replacement);
  entry.contentSnippet = snippet;
}

function replaceBRs(str) {
  return str.replace(/<br\s*>/gi, ' ');
}

this.searchGoogleFeeds = searchGoogleFeeds;

}
