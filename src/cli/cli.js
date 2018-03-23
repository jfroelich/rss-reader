import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {archive_entries} from '/src/feed-ops/archive-entries.js';
import rdb_refresh_feed_icons from '/src/feed-ops/refresh-feed-icons.js';
import entry_store_remove_lost_entries from '/src/feed-ops/remove-lost-entries.js';
import entry_store_remove_orphans from '/src/feed-ops/remove-orphaned-entries.js';
import {PollService} from '/src/poll-service/poll-service.js';
import * as rdb from '/src/rdb/rdb.js';

async function cli_archive_entries() {
  let conn, max_age;
  const channel = new BroadcastChannel('reader');
  await archive_entries(conn, channel, max_age);
  channel.close();
}

async function refresh_icons() {
  const fs = new FaviconService();
  const [rconn, iconn] = await Promise.all([rdb.open(), fs.open()]);
  await rdb_refresh_feed_icons(rconn, iconn);
  rconn.close();
  iconn.close();
}

async function poll_feeds() {
  // channel-less poll
  const service = new PollService();
  service.ignore_recency_check = true;
  service.ignore_modified_check = true;
  service.console = console;
  await service.init();
  await service.poll_feeds();
  service.close();
}

async function remove_lost_entries(limit) {
  let conn;
  const channel = new BroadcastChannel('reader');
  await entry_store_remove_lost_entries(conn, channel, console);
  channel.close();
}

async function remove_orphans() {
  let conn;
  const channel = new BroadcastChannel('reader');
  await entry_store_remove_orphans(conn, channel);
  channel.close();
}

async function lookup_favicon(url_string, cached) {
  const url = new URL(url_string);

  const fs = new FaviconService();
  fs.console = console;

  let conn;
  if (cached) {
    conn = await fs.open();
    fs.conn = conn;
  }

  const icon_url_string = await fs.lookup(url);
  if (cached) {
    conn.close();
  }

  return icon_url_string;
}

async function fs_clear() {
  const fs = new FaviconService();
  const conn = await fs.open();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}

async function fs_compact() {
  const fs = new FaviconService();
  const conn = await fs.open();
  fs.conn = conn;
  await fs.compact();
  conn.close();
}

const cli = {
  archive_entries: cli_archive_entries,
  clear_favicons: fs_clear,
  compact_favicons: fs_compact,
  remove_orphans: remove_orphans,
  remove_lost_entries: remove_lost_entries,
  lookup_favicon: lookup_favicon,
  poll_feeds: poll_feeds,
  refresh_icons: refresh_icons
};

window.cli = cli;  // expose to console
