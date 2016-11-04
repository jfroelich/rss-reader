// See license.md

'use strict';

async function fetch_html(url, log = SilentConsole) {
  log.log('Fetching html', url.href);
  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';
  const response = await fetch(url.href, opts);
  log.debug('Fetched html', url.href);
  if(!response.ok)
    throw new Error(response.status + ' ' + response.statusText);
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if(!type.includes('text/html'))
    throw new Error('Invalid mime type ' + content_type);
  const text = await response.text();
  log.debug('Read response text', url.href, text.length);
  const parser = new DOMParser();

  // TODO: parseFromString might be the slowest part of the entire polling
  // process. Look into how to improve this performance.
  // Maybe set an upper bound on text size like 5m characters
  // Maybe use a streaming API somehow so it can be exit early

  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName !== 'html')
    throw new Error('Invalid html ' + url.href);
  // TODO: maybe return an array for destructuring or learn about obj destr
  return {'document': doc, 'url': response.url};
}
