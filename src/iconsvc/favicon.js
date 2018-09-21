import {FaviconService} from '/src/iconsvc/favicon-service.js';

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

  if (!feed.urls) {
    return;
  }

  if (!feed.urls.length) {
    return;
  }

  const url_string = feed.urls[feed.urls.length - 1];
  if (!url_string) {
    return;
  }

  // Throw if url_string is invalid or relative
  const tail_url = new URL(url_string);
  return new URL(tail_url.origin);
}
