// See license.md

'use strict';

async function search_google_feeds(query, log = SilentConsole) {
  if(typeof query !== 'string' || !query.trim().length)
    throw new TypeError();

  const replacement = '\u2026';
  const title_max_len = 200;
  const snippet_max_len = 400;

  const fetch_opts = {
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
  const response = await fetch(url, fetch_opts);

  if(!response.ok)
    throw new Error(response.status);
  const result = await response.json();
  const data = result.responseData;
  const query = data.query || '';
  const response_entries = data.entries || [];
  const entries_with_urls = [];

  for(let entry of response_entries) {
    if(entry.url)
      entries_with_urls.push(entry);
  }

  const entries_with_valid_url_objects = [];
  for(let entry of entries_with_urls) {
    try {
      const url_obj = new URL(entry.url);
      entry.url = url_obj;
      entries_with_valid_url_objects.push(entry);
    } catch(error) {}
  }

  const distinct_entries = [];
  const seen_urls = [];
  for(let entry of entries_with_valid_url_objects) {
    if(!seen_urls.includes(entry.url.href)) {
      seen_urls.push(entry.url.href);
      distinct_entries.push(entry);
    }
  }

  // Sanitize title
  for(let entry of distinct_entries) {
    let title = entry.title;
    if(title) {
      title = filter_control_chars(title);
      title = replace_tags(title, '');
      title = truncate_html(title, title_max_len);
      entry.title = title;
    }
  }

  for(let entry of distinct_entries) {
    let snippet = entry.contentSnippet;
    if(snippet) {
      snippet = filter_control_chars(snippet);
      snippet = snippet.replace(/<br\s*>/gi, ' ');
      snippet = truncate_html(snippet, snippet_max_len, replacement);
      entry.contentSnippet = snippet;
    }
  }

  // TODO: return array for easier destructuring? or can objects easily
  // be destructured?
  return {'query': query, 'entries': distinct_entries};
}
