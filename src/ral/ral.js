import {activate_feed as activate_feed_impl} from '/src/app/operations/activate-feed.js';
import {deactivate_feed as deactivate_feed_impl} from '/src/app/operations/deactivate-feed.js';
import {find_feed_by_id as find_feed_by_id_impl} from '/src/app/operations/find-feed-by-id.js';
import {for_each_active_feed} from '/src/app/operations/for-each-active-feed.js';
import {get_feeds as get_feeds_with_conn} from '/src/app/operations/get-feeds.js';
import {viewable_entries_for_each} from '/src/app/operations/viewable-entries-for-each.js';
import {Exim} from '/src/exim/exim.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {SubscribeOperation} from '/src/feed-ops/subscribe.js';
import unsubscribe from '/src/feed-ops/unsubscribe.js';
import {PollService} from '/src/poll-service/poll-service.js';
import * as rdb from '/src/rdb/rdb.js';

export async function get_feeds(title_sort_flag) {
  const conn = await rdb.open();
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
  const conn = await rdb.open();
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


  const open_promises = [rdb.open(), fs.open()];
  [exim.rconn, exim.iconn] = await Promise.all(open_promises);
  await exim.import_opml(files);
  exim.rconn.close();
  exim.iconn.close();
}

export async function export_opml(title) {
  const exim = new Exim();
  exim.rconn = await rdb.open();
  await exim.export_opml(title);
  exim.rconn.close();
}

export async function load_initial_data(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  const conn = await rdb.open();
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

  const conn_promises = Promise.all([rdb.open(), fs.open()]);
  [op.rconn, op.iconn] = await conn_promises;
  const result = await op.subscribe(url);
  op.rconn.close();
  op.iconn.close();
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
  await activate_feed_impl(conn, channel, feed_id);
  conn.close();
}

export async function deactivate_feed(channel, feed_id, reason) {
  const conn = await rdb.open();
  await deactivate_feed_impl(conn, channel, feed_id, reason);
  conn.close();
}
