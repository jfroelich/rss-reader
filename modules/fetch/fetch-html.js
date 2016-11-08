// See license.md

'use strict';

// TODO: parseFromString might be the slowest part of the entire polling
// process. Look into how to improve this performance.
// Maybe set an upper bound on text size like 5m characters
// Maybe use a streaming API somehow so it can be exit early

// Returns a Document object or throws an error. When a timeout occurs, the
// fetch is not canceled, but this still rejects early.
async function fetch_html(url, timeout = 0, log = SilentConsole) {
  log.log('GET', url);
  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const promises = [fetch(url, opts)];
  if(timeout)
    promises.push(fetch_timeout(timeout));
  const response = await Promise.race(promises);

  // Treat unwanted response code as error
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat empty responses as an error
  if(response.status === 204)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat unacceptable content type as error
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if(!type.includes('text/html'))
    throw new Error(`Invalid mime type ${type} ${url}`);

  log.debug('GOT', response.status, response.statusText, url);
  const text = await response.text();
  if(!text.length)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  log.debug('Response text length', text.length, url);

  // Bubble-up parse exceptions
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName !== 'html')
    throw new Error(
      `Invalid document element ${doc.documentElement.nodeName} ${url}`);

  return {
    'doc': doc,
    'response_url': response.url
  };
}
