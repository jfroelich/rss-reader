import * as favicon_service from '/src/favicon-service/favicon-service.js';
import archive_entries from '/src/feed-ops/archive-entries.js';
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
  const open_promises = [rdb.open(), favicon_service.open()];
  const [reader_conn, favicon_conn] = await Promise.all(open_promises);
  await rdb_refresh_feed_icons(reader_conn, favicon_conn);
  reader_conn.close();
  favicon_conn.close();
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

async function lookup_favicon(url, cached) {
  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await favicon_service.open();
  }

  const icon_url_string = await favicon_service.lookup(query);
  if (cached) {
    query.conn.close();
  }

  return icon_url_string;
}

const cli = {
  archive_entries: cli_archive_entries,
  clear_favicons: favicon_service.clear,
  compact_favicons: favicon_service.compact,
  remove_orphans: remove_orphans,
  remove_lost_entries: remove_lost_entries,
  lookup_favicon: lookup_favicon,
  poll_feeds: poll_feeds,
  refresh_icons: refresh_icons
};

window.cli = cli;  // expose to console
