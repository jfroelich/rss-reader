import {FaviconService} from '/src/lib/favicon-service.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import {get_feeds, update_feed} from '/src/reader-db.js';

export function favicon_create_conn() {
  const service = new FaviconService();
  return service.open();
}

export async function favicon_clear() {
  const fs = new FaviconService();
  const conn = await favicon_create_conn();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}

export async function favicon_compact() {
  const fs = new FaviconService();
  fs.conn = await favicon_create_conn();
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
export function favicon_lookup(conn, url, document, fetch = true) {
  const fs = new FaviconService();
  fs.conn = conn;
  fs.skip_fetch = !fetch;
  return fs.lookup(url, document);
}

export function favicon_create_feed_lookup_url(feed) {
  if (feed.link) {
    return new URL(feed.link);
  }

  const tail_url = new URL(list_peek(feed.urls));
  return new URL(tail_url.origin);
}

export async function favicon_refresh_feeds(rconn, iconn, channel) {
  const feeds = await get_feeds(rconn, 'active');
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed(rconn, iconn, channel, feed));
  }
  return Promise.all(promises);
}

async function refresh_feed(rconn, iconn, channel, feed) {
  if (list_is_empty(feed.urls)) {
    return;
  }

  const lookup_url = favicon_create_feed_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  let doc, fetch_flag = true;
  const icon_url_string =
      await favicon_lookup(iconn, lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    await update_feed(rconn, channel, feed);
  }
}
