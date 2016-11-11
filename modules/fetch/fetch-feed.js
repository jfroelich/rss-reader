// See license.md

'use strict';

// Resolves with a basic object with properties feed and entries
// feed is a feed object. entries is an array of entry objects, that is always
// defined but may be zero length.
async function fetch_feed(url, timeout = 0, log = SilentConsole) {
  if(typeof url !== 'string' || !url.length)
    throw new TypeError(`Invalid url ${url}`);
  log.log('GET', url);
  const accepts = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const options = {};
  options.credentials = 'omit';// no cookies
  options.method = 'GET';
  options.headers = {'Accept': accepts};
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';

  // Race timeout with fetch
  const promises = [fetch(url, options)];
  if(timeout)
    promises.push(fetch_timeout(timeout));
  const response = await Promise.race(promises);

  // Treat non-network errors as an error
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat 204 No content as error
  if(response.status === 204)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  // Treat unacceptable content type as error
  // Allow for xml served as html
  // TODO: be stricter here?
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if(!type.includes('xml') && !type.includes('text/html'))
    throw new Error(`Invalid content type ${type} ${url}`);

  log.debug(`Response ${response.status} ${response.statusText} ${url}`);
  const text = await response.text();
  const doc = parse_xml(text);
  const {feed, entries} = parse_feed(doc);
  Feed.addURL(feed, url);
  Feed.addURL(feed, response.url);
  feed.dateFetched = new Date();
  const modified_header = response.headers.get('Last-Modified');
  if(modified_header) {
    try {
      feed.dateLastModified = new Date(modified_header);
    } catch(error) {
    }
  }

  return {'feed': feed, 'entries': entries};
}
