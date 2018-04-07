import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';
import {rdr_archive} from '/src/operations/archive-entries.js';
import {rdr_create_channel} from '/src/operations/rdr-create-channel.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/operations/rdr-create-icon-conn.js';
import {rdr_lookup_icon} from '/src/operations/rdr-lookup-icon.js';
import {rdr_poll_feeds} from '/src/operations/rdr-poll-feeds.js';
import {refresh_feed_icons} from '/src/operations/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/operations/remove-lost-entries.js';
import {remove_orphans} from '/src/operations/remove-orphaned-entries.js';

async function cli_archive() {
  const channel = rdr_create_channel();
  const conn = await rdr_create_conn();
  await rdr_archive(conn, channel, console, /* max_age */ undefined);
  channel.close();
  conn.close();
}

async function refresh_icons() {
  const channel = rdr_create_channel();
  const proms = [rdr_create_conn(), rdr_create_icon_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  await refresh_feed_icons(rconn, iconn, channel, console);
  rconn.close();
  iconn.close();
  channel.close();
}

async function poll_feeds() {
  const rconn = await rdr_create_conn();
  const iconn = await rdr_create_icon_conn();
  const channel = rdr_create_channel();

  const options = {};
  options.ignore_recency_check = true;
  options.ignore_modified_check = true;

  await rdr_poll_feeds(rconn, iconn, channel, console, options);

  channel.close();
  rconn.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const conn = await rdr_create_conn();
  const channel = new BroadcastChannel('reader');
  await remove_lost_entries_impl(conn, channel, console);
  channel.close();
  conn.close();
}

async function cli_remove_orphans() {
  const conn = await rdr_create_conn();
  const channel = new BroadcastChannel('reader');
  await remove_orphans_impl(conn, channel, console);
  channel.close();
  conn.close();
}

async function lookup_favicon(url_string, cached) {
  const url = new URL(url_string);

  let conn;
  if (cached) {
    conn = await rdr_create_icon_conn();
  }

  const skip_fetch = false;
  const icon_url_string = await rdr_lookup_icon(conn, console, skip_fetch, url);
  if (cached) {
    conn.close();
  }

  return icon_url_string;
}

async function fs_clear() {
  const fs = new FaviconService();
  const conn = await rdr_create_icon_conn();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}

async function fs_compact() {
  const conn = await rdr_create_icon_conn();
  const fs = new FaviconService();
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
