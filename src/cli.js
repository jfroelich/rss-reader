import {db_archive_entries} from '/src/db/db-archive-entries.js';
import {db_open} from '/src/db/db-open.js';
import {db_remove_lost_entries} from '/src/db/db-remove-lost-entries.js';
import {db_remove_orphaned_entries} from '/src/db/db-remove-orphaned-entries.js';
import {favicon_clear, favicon_compact, favicon_create_conn, favicon_lookup, favicon_refresh_feeds} from '/src/favicon.js';
import {log} from '/src/log.js';
import {poll_feed} from '/src/poll/poll-feed.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {subscribe} from '/src/subscribe.js';

// The cli module exports several functions to the global window object in order
// to make those functions available in the browser's console. This module is
// not intended for use by testing modules or to be called by other code.
//
// The cli exists because:
// * it provides direct developer access to functions
// * it is more stable than the view (for now)
// * it leads to better design by providing a calling context other than normal
// dom event handlers in a view, which helps avoid view-dependent code from
// appearing where it should not
// * it ensures headless support


async function cli_subscribe(url_string, poll = true) {
  const url = new URL(url_string);
  const op = {};
  const proms = [db_open(), favicon_create_conn()];
  [op.rconn, op.iconn] = await Promise.all(proms);

  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.subscribe = subscribe;

  const options = {fetch_timeout: 3000, notify: true};
  const feed = await op.subscribe(url, options);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(op.rconn, op.iconn, op.channel, poll_options, feed);
  }

  op.rconn.close();
  op.iconn.close();
  op.channel.close();
}

async function cli_archive_entries() {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.db_archive_entries = db_archive_entries;
  let max_age;
  await op.db_archive_entries(max_age);
  op.channel.close();
  op.conn.close();
}

async function cli_refresh_icons() {
  // TODO: no need for extra vars here, assign directly into op

  const proms = [db_open(), favicon_create_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel(localStorage.channel_name);

  const op = {};
  op.rconn = rconn;
  op.iconn = iconn;
  op.channel = channel;
  op.favicon_refresh_feeds = favicon_refresh_feeds;
  await op.favicon_refresh_feeds();
  rconn.close();
  iconn.close();
  channel.close();
}

async function cli_poll_feeds() {
  // TODO: open both and await Promise.all

  const rconn = await db_open();
  const iconn = await favicon_create_conn();
  const channel = new BroadcastChannel(localStorage.channel_name);

  const options = {};
  options.ignore_recency_check = true;

  await poll_feeds(rconn, iconn, channel, options);

  channel.close();
  rconn.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.db_remove_lost_entries = db_remove_lost_entries;
  await op.db_remove_lost_entries();
  op.conn.close();
  op.channel.close();
}

async function cli_remove_orphans() {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.db_remove_orphaned_entries = db_remove_orphaned_entries;
  await op.db_remove_orphaned_entries();
  op.conn.close();
  op.channel.close();
}

async function cli_lookup_favicon(url_string, cached) {
  let document, fetch_flag = true;
  const url = new URL(url_string);

  const op = {};

  if (cached) {
    op.conn = await favicon_create_conn();
  }

  op.favicon_lookup = favicon_lookup;

  const icon_url_string = await op.favicon_lookup(url, document, fetch_flag);

  if (cached) {
    op.conn.close();
  }

  return icon_url_string;
}

function cli_enable_logging() {
  localStorage.debug = '1';
}

function cli_disable_logging() {
  delete localStorage.debug;
}

const cli = {
  archive: cli_archive_entries,
  clear_icons: favicon_clear,
  compact_icons: favicon_compact,
  db_remove_orphaned_entries: cli_remove_orphans,
  db_remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe,
  enable_logging: cli_enable_logging,
  disable_logging: cli_disable_logging
};

window.cli = cli;  // expose to console
