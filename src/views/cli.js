import {FaviconService} from '/src/lib/favicon-service.js';
import {archive_entries} from '/src/ops/archive-entries.js';
import {clear_icons} from '/src/ops/clear-icons.js';
import {create_channel} from '/src/ops/create-channel.js';
import {create_conn} from '/src/ops/create-conn.js';
import {create_icon_conn} from '/src/ops/create-icon-conn.js';
import {lookup_icon} from '/src/ops/lookup-icon.js';
import {poll_feed} from '/src/ops/poll-feed.js';
import {poll_feeds} from '/src/ops/poll-feeds.js';
import {refresh_feed_icons} from '/src/ops/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/ops/remove-lost-entries.js';
import {remove_orphaned_entries} from '/src/ops/remove-orphaned-entries.js';
import {subscribe} from '/src/ops/subscribe.js';

async function cli_subscribe(url_string, poll = true) {
  const url = new URL(url_string);
  const op = {};
  const proms = [create_conn(), create_icon_conn()];
  [op.rconn, op.iconn] = await Promise.all(proms);

  op.channel = create_channel();
  op.console = console;
  op.subscribe = subscribe;

  const options = {fetch_timeout: 3000, notify: true};
  const feed = await op.subscribe(url, options);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(
        op.rconn, op.iconn, op.channel, console, poll_options, feed);
  }

  op.rconn.close();
  op.iconn.close();
  op.channel.close();
}

async function cli_archive_entries() {
  const ac = {};
  ac.conn = await create_conn();
  ac.channel = create_channel();
  ac.console = console;

  let max_age;
  await archive_entries.call(ac, max_age);
  ac.channel.close();
  ac.conn.close();
}

async function cli_refresh_icons() {
  const channel = create_channel();
  const proms = [create_conn(), create_icon_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  await refresh_feed_icons(rconn, iconn, channel, console);
  rconn.close();
  iconn.close();
  channel.close();
}

async function cli_poll_feeds() {
  const rconn = await create_conn();
  const iconn = await create_icon_conn();
  const channel = create_channel();

  const options = {};
  options.ignore_recency_check = true;

  await poll_feeds(rconn, iconn, channel, console, options);

  channel.close();
  rconn.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const op = {};
  op.conn = await create_conn();
  console.debug(
      '%s: connected to db %s', cli_remove_lost_entries.name, op.conn.name);
  op.channel = create_channel();
  console.debug(
      '%s: created channel', cli_remove_lost_entries.name, op.channel.name);
  op.console = console;
  op.remove_lost_entries = remove_lost_entries;
  await op.remove_lost_entries();
  console.debug(
      '%s: closing db conn', cli_remove_lost_entries.name, op.conn.name);
  op.conn.close();
  console.debug(
      '%s: closing channel', cli_remove_lost_entries.name, op.channel.name);
  op.channel.close();
}

async function cli_remove_orphans() {
  const conn = await create_conn();
  const channel = new BroadcastChannel('reader');
  await remove_orphans_impl(conn, channel, console);
  channel.close();
  conn.close();
}

async function cli_lookup_favicon(url_string, cached) {
  let document, fetch = true;
  const url = new URL(url_string);

  const op = {};
  op.conn = cached ? await create_icon_conn() : undefined;
  op.console = console;
  op.lookup = lookup_icon;

  const icon_url_string = await op.lookup(url, document, fetch);

  if (cached) {
    op.conn.close();
  }

  return icon_url_string;
}

async function cli_compact_icons() {
  const conn = await create_icon_conn();
  const fs = new FaviconService();
  fs.conn = conn;
  await fs.compact();
  conn.close();
}

const cli = {
  archive: cli_archive_entries,
  clear_icons: clear_icons,
  compact_icons: cli_compact_icons,
  remove_orphaned_entries: cli_remove_orphans,
  remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe
};

window.cli = cli;  // expose to console
