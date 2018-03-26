import * as rdb from '/src/app/handles/rdb.js';
import {refresh_feed_icons} from '/src/app/operations/refresh-feed-icons.js';
import {remove_lost_entries as remove_lost_entries_impl} from '/src/app/operations/remove-lost-entries.js';
import {remove_orphans as remove_orphans_impl} from '/src/app/operations/remove-orphaned-entries.js';
import {Archiver} from '/src/archive-entries.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {PollService} from '/src/poll-service/poll-service.js';

async function cli_archive() {
  const arch = new Archiver();
  arch.console = console;
  arch.channel = new BroadcastChannel('reader');
  await arch.open();
  await arch.archive();
  arch.close();
  arch.channel.close();
}

async function refresh_icons() {
  let channel;
  const fs = new FaviconService();
  const [rconn, iconn] = await Promise.all([rdb.open(), fs.open()]);
  fs.conn = iconn;
  await refresh_feed_icons(rconn, fs, channel);
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

async function remove_lost_entries() {
  const conn = await rdb.open();
  const channel = new BroadcastChannel('reader');
  await remove_lost_entries_impl(conn, channel, console);
  channel.close();
  conn.close();
}

async function remove_orphans() {
  const conn = await rdb.open();
  const channel = new BroadcastChannel('reader');
  await remove_orphans_impl(conn, channel);
  channel.close();
  conn.close();
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
  archive: cli_archive,
  clear_favicons: fs_clear,
  compact_favicons: fs_compact,
  remove_orphans: remove_orphans,
  remove_lost_entries: remove_lost_entries,
  lookup_favicon: lookup_favicon,
  poll_feeds: poll_feeds,
  refresh_icons: refresh_icons
};

window.cli = cli;  // expose to console
