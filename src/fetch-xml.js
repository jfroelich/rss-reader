// See license.md

'use strict';

function fetch_xml(url, log = SilentConsole) {
  return new Promise(fetch_xml_impl.bind(undefined, url, log));
}

async function fetch_xml_impl(url, log, resolve, reject) {
  log.log('Fetching', url.href);
  const accepts = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(', ');

  const opts = {};
  opts.credentials = 'omit';// no cookies
  opts.method = 'GET';
  opts.headers = {'Accept': accepts};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  try {
    let response = await fetch(url.href, opts);

    if(!response.ok) {
      reject(new Error(response.statusText));
      return;
    }

    const type = response.headers.get('Content-Type');
    if(type) {
      const norm_type = type.toLowerCase();
      if(!norm_type.includes('xml') && !norm_type.includes('text/html')) {
        log.debug(url.href, 'invalid type', type);
        reject(new Error('invalid response content type'));
        return;
      }
    }

    let last_mod_date;
    const last_mod_str = response.headers.get('Last-Modified');
    if(last_mod_str)
      last_mod_date = new Date(last_mod_str);
    const text = await response.text();
    const doc = parse_xml(text);
    const result = {};
    result.document = doc;
    result.responseURLString = response.url;
    result.lastModifiedDate = last_mod_date;
    resolve(result);
  } catch(error) {
    reject(error);
  }
}
