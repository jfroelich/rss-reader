import {activate_feed as activate_feed_impl} from '/src/operations/activate-feed.js';
import {deactivate_feed as deactivate_feed_impl} from '/src/operations/deactivate-feed.js';
import {find_feed_by_id as find_feed_by_id_impl} from '/src/operations/find-feed-by-id.js';
import {for_each_active_feed} from '/src/operations/for-each-active-feed.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/operations/rdr-create-icon-conn.js';
import {rdr_import} from '/src/operations/rdr-import-opml.js';
import {rdr_poll_feeds} from '/src/operations/rdr-poll-feeds/rdr-poll-feeds.js';
import {rdr_subscribe} from '/src/operations/subscribe.js';
import {unsubscribe} from '/src/operations/unsubscribe.js';
import {viewable_entries_for_each} from '/src/operations/viewable-entries-for-each.js';

export async function import_opml(channel, files) {
  const ctx = {};
  ctx.fetch_timeout = 10 * 100;
  ctx.channel = channel;
  ctx.console = console;

  const open_promises = [rdr_create_conn(), rdr_create_icon_conn()];
  [ctx.rconn, ctx.iconn] = await Promise.all(open_promises);
  await rdr_import(ctx, files);
  ctx.rconn.close();
  ctx.iconn.close();
}

export async function load_initial_data(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  const conn = await rdr_create_conn();
  const p1 = viewable_entries_for_each(
      conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
  const p2 = for_each_active_feed(conn, feed_handler);
  await Promise.all([p1, p2]);
  conn.close();
}

export async function poll_feeds(channel, console) {
  const rconn = await rdr_create_conn();
  const iconn = await rdr_create_icon_conn();

  const options = {};
  options.ignore_recency_check = true;
  options.ignore_modified_check = true;

  await rdr_poll_feeds(rconn, iconn, channel, console, options);

  // channel lifetime is caller concern, leave it open
  rconn.close();
  iconn.close();
}

export async function ral_subscribe(channel, url) {
  let null_console, fetch_timeout, notify_flag = true;

  const conn_promises =
      Promise.all([rdr_create_conn(), rdr_create_icon_conn()]);
  const [rconn, iconn] = await conn_promises;
  const feed = await rdr_subscribe(
      rconn, iconn, channel, null_console, fetch_timeout, notify_flag, url);
  rconn.close();
  iconn.close();
  return feed;
}

export async function ral_unsubscribe(channel, feed_id) {
  const conn = await rdr_create_conn();
  const result = await unsubscribe(conn, channel, feed_id);
  conn.close();
  return result;
}

export async function activate_feed(channel, feed_id) {
  const conn = await rdr_create_conn();
  let null_console = null;
  await activate_feed_impl(conn, channel, null_console, feed_id);
  conn.close();
}

export async function deactivate_feed(channel, feed_id, reason) {
  const conn = await rdr_create_conn();
  await deactivate_feed_impl(conn, channel, feed_id, reason);
  conn.close();
}
