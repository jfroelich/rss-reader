// See license.md

'use strict';

// TODO: remove support for exclude_entries, it isn't much value and is
// annoying to use as an extra param everywhere

// Resolves with a basic object with properties feed and entries
// feed is a feed object. entries is an array of entry objects, that is always
// defined but may be zero length.
// This does not guarantee that entries have urls
function fetch_feed(url, exclude_entries = false, log = SilentConsole) {
  return new Promise(async function impl(resolve, reject) {
    log.log('Fetching feed', url.href);
    const accepts = [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml;q=0.9',
      'text/xml;q=0.8'
    ].join(', ');

    const fetch_opts = {};
    fetch_opts.credentials = 'omit';// no cookies
    fetch_opts.method = 'GET';
    fetch_opts.headers = {'Accept': accepts};
    fetch_opts.mode = 'cors';
    fetch_opts.cache = 'default';
    fetch_opts.redirect = 'follow';
    fetch_opts.referrer = 'no-referrer';

    let response;
    try {
      response = await fetch(url.href, fetch_opts);
    } catch(error) {
      reject(error);
      return;
    }

    if(!response.ok) {
      reject(new Error(response.statusText));
      return;
    }

    const type = response.headers.get('Content-Type');
    if(type) {
      const norm_type = type.toLowerCase();
      if(!norm_type.includes('xml') && !norm_type.includes('text/html')) {
        reject(new Error('Invalid content type ' + type));
        return;
      }
    }

    let last_mod_date;
    try {
      last_mod_date = new Date(response.headers.get('Last-Modified'));
    } catch(error) {
    }

    let text, doc, parse_result;
    try {
      text = await response.text();
      doc = parse_xml(text);
      parse_result = parse_feed(doc, exclude_entries);
    } catch(error) {
      reject(error);
      return;
    }

    const feed = parse_result.feed;
    add_feed_url(feed, url.href);
    if(response.url)
      add_feed_url(feed, response.url);
    feed.dateFetched = new Date();
    feed.dateLastModified = last_mod_date;
    const output = {};
    output.feed = feed;
    if(!exclude_entries)
      output.entries = parse_result.entries;
    resolve(output);
  });
}
