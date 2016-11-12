// See license.md

'use strict';

// Resolves with a basic object with properties feed and entries
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

  const text = await response.text();
  const parsed_feed = FeedParser.parseFromString(text);

  // Split the parsed feed into a feed object and an entries array
  const entries = parsed_feed.entries;
  const feed = parsed_feed;
  delete feed.entries;

  // Supply a default date for the feed
  feed.datePublished = feed.datePublished || new Date();

  // Normalize the feed's link value
  if(feed.link) {
    try {
      feed.link = new URL(feed.link).href;
    } catch(error) {
      console.warn(error);
      delete feed.link;
    }
  }

  // Suppy a default date for entries
  entries.filter((e)=> !e.datePublished).forEach((e) =>
    e.datePublished = feed.datePublished);

  // Convert entry.link into entry.urls array
  entries.forEach((e) => {
    if(!e.link) return;
    Entry.addURL(e, e.link);
    delete e.link;
  });

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
