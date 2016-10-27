// See license.md

'use strict';

// TODO: return a promise
// TODO: use async

function fetch_html(url, log = SilentConsole) {
  return new Promise(fetch_html_impl.bind(undefined, url, log));
}

async function fetch_html_impl(url, log, resolve, reject) {
  log.log('Fetching html of url', url.href);
  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  try {
    let response = await fetch(url.href, opts);
    if(!response.ok)
      throw new Error(response.status);
    log.debug('Fetched', url.href);
    const text = await response.text();
    log.debug('Read text of %s (%d chars)', url.href, text.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    if(!doc || !doc.documentElement ||
      doc.documentElement.localName !== 'html')
      throw new Error('not html');
    log.debug('Parsed doc of', url.href);
    resolve({'document': doc, 'response_url_str': response.url});
  } catch(error) {
    reject(error);
  }
}
