import * as exim from '/src/exim/exim.js';
import * as favicon_service from '/src/favicon-service/favicon-service.js';
import subscribe from '/src/feed-ops/subscribe.js';
import unsubscribe from '/src/feed-ops/unsubscribe.js';
import * as poll_service from '/src/poll-service/poll-service.js';
import * as rdb from '/src/rdb/rdb.js';

export async function get_feeds(title_sort_flag) {
  const conn = await rdb.open();
  const feeds = await rdb.get_feeds(conn);
  conn.close();

  if (title_sort_flag) {
    feeds.sort(feed_compare);
  }

  return feeds;
}

function feed_compare(a, b) {
  const atitle = a.title ? a.title.toLowerCase() : '';
  const btitle = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(atitle, btitle);
}

export async function find_feed_by_id(feed_id) {
  const conn = await rdb.open();
  const feed = await rdb.find_feed_by_id(conn, feed_id);
  conn.close();
  return feed;
}

export async function import_opml(channel, files) {
  const timeout = 10 * 1000;
  const open_promises = [rdb.open(), favicon_service.open()];
  const [reader_conn, favicon_conn] = await Promise.all(open_promises);
  await exim.import_opml(reader_conn, favicon_conn, channel, timeout, files);
  reader_conn.close();
  favicon_conn.close();
}

export async function export_opml(title) {
  const conn = await rdb.open();
  await exim.export_opml(conn, title);
  conn.close();
}

export async function load_initial_data(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  const conn = await rdb.open();
  const p1 = rdb.viewable_entries_for_each(
      conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
  const p2 = rdb.for_each_active_feed(conn, feed_handler);
  await Promise.all([p1, p2]);
  conn.close();
}

export async function poll_feeds(channel, console) {
  const conn_promises = [rdb.open(), favicon_service.open()];
  const [reader_conn, favicon_conn] = await Promise.all(conn_promises);

  const ctx = {};
  ctx.ignoreRecencyCheck = true;
  ctx.ignoreModifiedCheck = true;
  ctx.console = console;
  ctx.channel = channel;
  ctx.feedConn = reader_conn;
  ctx.iconConn = favicon_conn;
  await poll_service.poll_service_poll_feeds(ctx);

  reader_conn.close();
  favicon_conn.close();
}

export async function ral_subscribe(channel, url) {
  const ctx = {};
  ctx.channel = channel;
  ctx.notify = true;
  ctx.fetchFeedTimeout = 2000;

  const conn_promises = Promise.all([rdb.open(), favicon_service.open()]);
  const [reader_conn, favicon_conn] = await conn_promises;
  ctx.feedConn = reader_conn;
  ctx.iconConn = favicon_conn;
  const result = await subscribe(ctx, url);
  reader_conn.close();
  favicon_conn.close();
  return result;
}

export async function ral_unsubscribe(channel, feed_id) {
  const conn = await rdb.open();
  const result = await unsubscribe(conn, channel, feed_id);
  conn.close();
  return result;
}

export async function activate_feed(channel, feed_id) {
  const conn = await rdb.open();
  await rdb.feed_activate(conn, channel, feed_id);
  conn.close();
}

export async function deactivate_feed(channel, feed_id, reason) {
  const conn = await rdb.open();
  await rdb.rdb_feed_deactivate(conn, channel, feed_id, reason);
  conn.close();
}
