import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {rdr_conn_close, rdr_conn_create} from '/src/objects/rdr-conn.js';
import {rdr_archive} from '/src/operations/archive-entries/archive-entries.js';
import {refresh_feed_icons} from '/src/operations/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/operations/remove-lost-entries.js';
import {remove_orphans} from '/src/operations/remove-orphaned-entries.js';
import {PollService} from '/src/poll-service/poll-service.js';

async function cli_archive() {
  const channel = new BroadcastChannel('reader');
  const conn = await rdr_conn_create();
  await rdr_archive(conn, channel, console, /* max_age */ null);
  channel.close();
  conn.close();
}

async function refresh_icons() {
  let channel;
  const fs = new FaviconService();
  const [rconn, iconn] = await Promise.all([rdr_conn_create(), fs.open()]);
  fs.conn = iconn;
  await refresh_feed_icons(rconn, fs, channel);
  rdr_conn_close(rconn);
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

async function cli_remove_lost_entries() {
  const conn = await rdr_conn_create();
  const channel = new BroadcastChannel('reader');
  await remove_lost_entries_impl(conn, channel, console);
  channel.close();
  rdr_conn_close(conn);
}

async function cli_remove_orphans() {
  const conn = await rdr_conn_create();
  const channel = new BroadcastChannel('reader');
  await remove_orphans_impl(conn, channel);
  channel.close();
  rdr_conn_close(conn);
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
  remove_orphans: cli_remove_orphans,
  remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: lookup_favicon,
  poll_feeds: poll_feeds,
  refresh_icons: refresh_icons
};

window.cli = cli;  // expose to console
