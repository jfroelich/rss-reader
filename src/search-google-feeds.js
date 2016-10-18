// See license.md

'use strict';

{

function search_google_feeds(query, log, callback) {
  if(typeof query !== 'string' || !query.trim().length)
    throw new TypeError();
  if(typeof callback !== 'function')
    throw new TypeError();

  const ctx = {};
  ctx.log = log || SilentConsole;
  ctx.replacement = '\u2026';
  ctx.title_max_len = 200;
  ctx.snippet_max_len = 400;
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
  ctx.log.log('GET', url);
  fetch(url, opts).then(on_fetch.bind(ctx)).catch(on_fetch_err.bind(ctx));
}

function on_fetch(response) {
  if(!response.ok) {
    this.log.log('Response status:', response.responseStatus);
    this.log.log('Response details:', response.responseDetails);
    this.callback({'type': 'error'});
    return;
  }

  response.text().then(on_read_txt.bind(this));
}

function on_fetch_err(error) {
  this.log.error(error);
  this.callback({'type': 'error'});
}

function on_read_txt(text) {
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
  entries = filter_entries_without_urls(entries);
  parse_entry_urls(entries);
  // Filter again to catch parse failures
  entries = filter_entries_without_urls(entries);
  entries = filter_dup_entries(entries);

  entries.forEach(sanitize_title, this);
  entries.forEach(sanitize_snippet, this);
  this.callback({'type': 'success', 'query': query, 'entries': entries});
}

function filter_entries_without_urls(entries) {
  const output = [];
  for(let entry of entries) {
    if(entry.url) {
      output.push(entry);
    }
  }
  return output;
}

function parse_entry_urls(entries) {
  for(let entry of entries) {
    try {
      entry.url = new URL(entry.url);
    } catch(error) {}
  }
}

function filter_dup_entries(entries) {
  const output = [], seen = [];
  for(let entry of entries) {
    if(!seen.includes(entry.url.href)) {
      seen.push(entry.url.href);
      output.push(entry);
    }
  }
  return output;
}

function sanitize_title(entry) {
  let title = entry.title;
  if(title) {
    title = filter_control_chars(title);
    title = replace_tags(title, '');
    title = truncate_html(title, this.title_max_len);
    entry.title = title;
  }
}

function sanitize_snippet(entry) {
  let snippet = entry.contentSnippet;
  if(snippet) {
    snippet = filter_control_chars(snippet);
    snippet = replace_brs(snippet);
    snippet = truncate_html(snippet, this.snippet_max_len,
      this.replacement);
    entry.contentSnippet = snippet;
  }
}

function replace_brs(str) {
  return str.replace(/<br\s*>/gi, ' ');
}

this.search_google_feeds = search_google_feeds;

}
