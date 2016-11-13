// See license.md

'use strict';

// Returns a Document object or throws an error. When a timeout occurs, the
// fetch is not canceled, but this still rejects early.
async function fetch_html(url, timeout = 0, log) {

  log = log || {'log': function(){}};

  log.debug('GET', url);
  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const promises = [fetch(url, opts)];

  // Temp, delete once tested, trying to avoid dependencies
  // also delete fetch-utils include
  //if(timeout)
    //promises.push(fetch_timeout(timeout));

  if(timeout) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(reject, timeout, new Error('Request timed out ' + url)));
    promises.push(timeoutPromise);
  }

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

  const parser = new DOMParser();
  // A parse error will become a rejection
  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName !== 'html')
    throw new Error(
      `Invalid document element ${doc.documentElement.nodeName} ${url}`);

  return {
    'doc': doc,
    'response_url': response.url
  };
}
