// See license.md

'use strict';

// Resolves with a basic object with properties feed and entries
// feed is a feed object. entries is an array of entry objects, that is always
// defined but may be zero length.
// This does not guarantee that entries have urls
async function fetch_feed(url, log = SilentConsole) {

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

  const response = await fetch(url.href, fetch_opts);
  if(!response.ok)
    throw new Error(response.statusText);

  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if(!type.includes('xml') && !type.includes('text/html'))
    throw new Error('Invalid content type ' + type);

  let last_mod_date;
  try {
    last_mod_date = new Date(response.headers.get('Last-Modified'));
  } catch(error) {
  }

  const text = await response.text();
  const doc = parse_xml(text);
  const parse_result = parse_feed(doc);
  add_feed_url(parse_result.feed, url.href);
  if(response.url)
    add_feed_url(parse_result.feed, response.url);
  parse_result.feed.dateFetched = new Date();
  if(last_mod_date)
    parse_result.feed.dateLastModified = last_mod_date;
  return parse_result;
}
