import {ReaderDAL} from '/src/dal.js';
import {FaviconService} from '/src/favicon/favicon-service.js';
import * as array from '/src/lang/array.js';

// Return a promise that resolves to a new connection to the favicon cache
// database
export function open() {
  const service = new FaviconService();
  return service.open();
}

// Remove all entries in the favicon cache
export async function clear() {
  const fs = new FaviconService();
  const conn = await open();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}

// Reduce the size of the favicon cache
export async function compact() {
  const fs = new FaviconService();
  fs.conn = await open();
  await fs.compact();
  fs.conn.close();
}

// Lookup the favicon url for a url. Returns a promise that resolves to the url
// (string).
// * url {URL} the location to investigate
// * document {Document} the pre-fetched document, optional
// * skip_fetch {Boolean} whether to attempt to fetch the full text of the
// resource, and if it is html, search for a url within the html, before
// continuing to check other places.
export function lookup(conn, url, document, fetch = true) {
  const fs = new FaviconService();
  fs.conn = conn;
  fs.skip_fetch = !fetch;
  return fs.lookup(url, document);
}

// Create the url to use for lookups given a database feed object
export function create_lookup_url(feed) {
  if (feed.link) {
    return new URL(feed.link);
  }

  const tail_url = new URL(array.peek(feed.urls));
  return new URL(tail_url.origin);
}

// Update the favicon of each of the feeds in the database
export async function refresh_feeds(rconn, iconn, channel) {
  const dal = new ReaderDAL();
  dal.conn = rconn;
  dal.channel = channel;

  const mode = 'active';
  const sorted = false;

  const feeds = await dal.getFeeds(mode, sorted);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed(rconn, iconn, channel, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed(rconn, iconn, channel, feed) {
  if (array.is_empty(feed.urls)) {
    return;
  }

  const lookup_url = create_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  let doc, fetch_flag = true;
  const icon_url_string = await lookup(iconn, lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    const dal = new ReaderDAL();
    dal.conn = rconn;
    dal.channel = channel;
    await dal.updateFeed(feed);
  }
}
