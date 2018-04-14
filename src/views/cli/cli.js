import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';
import {rdr_archive} from '/src/ops/rdr-archive-entries.js';
import {rdr_create_channel} from '/src/ops/rdr-create-channel.js';
import {rdr_create_conn} from '/src/ops/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/ops/rdr-create-icon-conn.js';
import {rdr_lookup_icon} from '/src/ops/rdr-lookup-icon.js';
import {rdr_poll_feeds} from '/src/ops/rdr-poll-feeds.js';
import {refresh_feed_icons} from '/src/ops/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/ops/remove-lost-entries.js';
import {remove_orphans} from '/src/ops/remove-orphaned-entries.js';
import {rdr_subscribe} from '/src/ops/subscribe.js';

async function cli_subscribe(url_string) {
  const url = new URL(url_string);

  const channel = rdr_create_channel();
  const proms = [rdr_create_conn(), rdr_create_icon_conn()];
  const [rconn, iconn] = await Promise.all(proms);

  let fetch_timeout = 3000;
  let notify_flag = false;
  const feed = await rdr_subscribe(
      rconn, iconn, channel, console, fetch_timeout, notify_flag, url);

  console.debug('Stored feed', feed);

  rconn.close();
  iconn.close();
  channel.close();
}

async function cli_archive() {
  const ac = {};
  ac.conn = await rdr_create_conn();
  ac.channel = rdr_create_channel();
  ac.console = console;

  let max_age;
  await rdr_archive.call(ac, max_age);
  ac.channel.close();
  ac.conn.close();
}

async function cli_refresh_icons() {
  const channel = rdr_create_channel();
  const proms = [rdr_create_conn(), rdr_create_icon_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  await refresh_feed_icons(rconn, iconn, channel, console);
  rconn.close();
  iconn.close();
  channel.close();
}

async function cli_poll_feeds() {
  const rconn = await rdr_create_conn();
  const iconn = await rdr_create_icon_conn();
  const channel = rdr_create_channel();

  const options = {};
  options.ignore_recency_check = true;

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

async function cli_lookup_favicon(url_string, cached) {
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

async function cli_clear_icons() {
  const fs = new FaviconService();
  const conn = await rdr_create_icon_conn();
  fs.conn = conn;
  await fs.clear();
  conn.close();
}

async function cli_compact_icons() {
  const conn = await rdr_create_icon_conn();
  const fs = new FaviconService();
  fs.conn = conn;
  await fs.compact();
  conn.close();
}

const cli = {
  archive: cli_archive,
  clear_icons: cli_clear_icons,
  compact_icons: cli_compact_icons,
  remove_orphans: cli_remove_orphans,
  remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe
};

window.cli = cli;  // expose to console
