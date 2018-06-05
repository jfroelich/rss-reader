import {get_feeds} from '/src/db/get-feeds.js';
import {write_feed} from '/src/db/write-feed.js';
import {FaviconService} from '/src/lib/favicon-service.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';

// TODO: the lib shouldn't know about database names and such, or at least,
// the app layer here should be the one specifying database name and version
// Basically the lib should not have defaults, and error out if options not set,
// and this should be setting params to calls to favicon_create_conn here always
// TODO: merge all app-tier favicon functionality here
// TODO: this should be the sole mediator of interactions with the
// favicon-service module, there should be no other direct interactions, this
// serves as a layer of indirection that makes the rest of the app resilient
// to changes
// TODO: need to redo the favicon-service lib, it was dumb to try and use a
// class, and it may be dumb to cram it all into one file
// TODO: should probably give up on the full lookup and just do origin lookups
// only, this is a library concern though

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
export function favicon_lookup(url, document, fetch = true) {
  const fs = new FaviconService();
  fs.conn = this.conn;
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


// TODOs:
// * document
// * test
// * use cursor for scalability over N-feeds instead of getAll
// * in fact, should probably use cursor.update, and should not even re-use
// `get_feeds` or some cursor walk helper, should directly interact with
// database without an intermediate layer
// * this should be using a single transaction, not sure how to handle the issue
// with transaction timeout during lookup. Probably should be doing two passes.
// One preload all feeds, saves just the most basic information (feed id, link,
// urls), then lookup favicons in mem, then second pass iterates feed store and
// updates. If a new feed created in between the two txns it will be missed,
// that's fine. If a feed is deleted in between the two txns, it will never try
// to interact with the intermediate lookup table so that's fine. If a feed is
// mutated in between, not really sure what to do. Also: what if this is called
// concurrently? what if a second call starts while first is running?
export async function favicon_refresh_feeds() {
  const feeds = await get_feeds(this.rconn, 'active');

  const promises = [];
  const refresh_feed_bound = refresh_feed.bind(this);
  for (const feed of feeds) {
    promises.push(refresh_feed_bound(feed));
  }

  return Promise.all(promises);
}

async function refresh_feed(feed) {
  if (list_is_empty(feed.urls)) {
    return;
  }

  const lookup_url = favicon_create_feed_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  let doc, fetch_flag = true;
  const lookup_op = {conn: this.iconn, favicon_lookup: favicon_lookup};
  const icon_url_string =
      await lookup_op.favicon_lookup(lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    await write_feed(this.rconn, this.channel, feed);
  }
}
