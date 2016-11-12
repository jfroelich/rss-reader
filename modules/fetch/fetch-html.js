// See license.md

'use strict';

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

  // Treat unwanted response codes as errors
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat empty responses as an error
  if(response.status === 204)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat unacceptable content type as error
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if(!type.includes('text/html'))
    throw new Error(`Invalid mime type ${type} ${url}`);

  const text = await response.text();
  if(!text.length)
    throw new Error(`${response.status} ${response.statusText} ${url}`);

  // For some reason the implementers of the new fetch API did not provide a
  // native reader for HTML, so we have to do the parsing by hand.
  // By not catching a parse exception in this async context it becomes a
  // rejection of the async function as intended.
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
