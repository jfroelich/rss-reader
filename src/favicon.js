import {for_each_active_feed} from '/src/db/for-each-active-feed.js';
import {write_feed} from '/src/db/write-feed.js';
import {FaviconService} from '/src/lib/favicon-service.js';
import {list_is_empty, list_peek} from '/src/lib/list.js';

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

export function favicon_lookup(url, document, fetch = true) {
  const fs = new FaviconService();
  fs.conn = this.conn;
  fs.console = this.console;
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

export async function favicon_refresh_feeds() {
  const promises = [];
  const refresh_feed_bound = refresh_feed.bind(this);
  await for_each_active_feed(
      this.rconn, feed => promises.push(refresh_feed_bound(feed)));
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
  const lookup_op = {
    conn: this.iconn,
    console: this.console,
    favicon_lookup: favicon_lookup
  };
  const icon_url_string =
      await lookup_op.favicon_lookup(lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    const update_op = {
      conn: this.rconn,
      channel: this.channel,
      console: this.console,
      write_feed: write_feed
    };
    await update_op.write_feed(
        feed, {validate: false, sanitize: false, set_date_updated: true});
  }
}
