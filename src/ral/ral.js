import {Exim} from '/src/exim/exim.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {rdr_conn_create} from '/src/objects/rdr-conn.js';
import {activate_feed as activate_feed_impl} from '/src/operations/activate-feed.js';
import {deactivate_feed as deactivate_feed_impl} from '/src/operations/deactivate-feed.js';
import {find_feed_by_id as find_feed_by_id_impl} from '/src/operations/find-feed-by-id.js';
import {for_each_active_feed} from '/src/operations/for-each-active-feed.js';
import {get_feeds as get_feeds_with_conn} from '/src/operations/get-feeds.js';
import {rdr_export} from '/src/operations/rdr-export.js';
import {viewable_entries_for_each} from '/src/operations/viewable-entries-for-each.js';
import {PollService} from '/src/poll-service/poll-service.js';
import {SubscribeOperation} from '/src/subscribe.js';
import unsubscribe from '/src/unsubscribe.js';

export async function get_feeds(title_sort_flag) {
  const conn = await rdr_conn_create();
  const feeds = await get_feeds_with_conn(conn);
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
  const conn = await rdr_conn_create();
  const feed = await find_feed_by_id_impl(conn, feed_id);
  conn.close();
  return feed;
}

export async function import_opml(channel, files) {
  const exim = new Exim();
  exim.fetch_timeout = 10 * 1000;
  exim.channel = channel;
  exim.console = console;


  const fs = new FaviconService();


  const open_promises = [rdr_conn_create(), fs.open()];
  [exim.rconn, exim.iconn] = await Promise.all(open_promises);
  await exim.import_opml(files);
  exim.rconn.close();
  exim.iconn.close();
}

export async function export_opml(title) {
  const conn = await rdr_conn_create();
  await rdr_export(conn, title);
  conn.close();
}

export async function load_initial_data(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  const conn = await rdr_conn_create();
  const p1 = viewable_entries_for_each(
      conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
  const p2 = for_each_active_feed(conn, feed_handler);
  await Promise.all([p1, p2]);
  conn.close();
}

export async function poll_feeds(channel, console) {
  const service = new PollService();
  service.console = console;
  service.ignore_recency_check = true;
  service.ignore_modified_check = true;
  await service.init(channel);
  await service.poll_feeds();
  service.close(/* close_channel */ false);
}

export async function ral_subscribe(channel, url) {
  const op = new SubscribeOperation();
  op.channel = channel;
  op.notify_flag = true;

  const fs = new FaviconService();

  const conn_promises = Promise.all([rdr_conn_create(), fs.open()]);
  [op.rconn, op.iconn] = await conn_promises;
  const result = await op.subscribe(url);
  op.rconn.close();
  op.iconn.close();
  return result;
}

export async function ral_unsubscribe(channel, feed_id) {
  const conn = await rdr_conn_create();
  const result = await unsubscribe(conn, channel, feed_id);
  conn.close();
  return result;
}

export async function activate_feed(channel, feed_id) {
  const conn = await rdr_conn_create();
  await activate_feed_impl(conn, channel, feed_id);
  conn.close();
}

export async function deactivate_feed(channel, feed_id, reason) {
  const conn = await rdr_conn_create();
  await deactivate_feed_impl(conn, channel, feed_id, reason);
  conn.close();
}
