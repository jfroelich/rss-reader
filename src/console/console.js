import * as config from '/src/config/config.js';
import * as cron_control from '/src/cron/cron.js';
import * as db from '/src/db/db.js';
import {archive_entries} from '/src/db/op/archive-entries.js';
import {remove_lost_entries} from '/src/db/op/remove-lost-entries.js';
import {remove_orphaned_entries} from '/src/db/op/remove-orphaned-entries.js';
import * as favicon from '/src/iconsvc/favicon.js';
import {poll_feed, poll_feeds} from '/src/poll-feeds/poll-feeds.js';
import {refresh_feed_icons} from '/src/refresh-feed-icons/refresh-feed-icons.js';
import {subscribe} from '/src/subscribe/subscribe.js';

// Exposes a command line interface to the console
// TODO: add command for removing untyped objects
// TODO: this module was actually better named as cli, console is just strange

async function cli_subscribe(url_string, poll = true) {
  const proms = [db.open_with_channel(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);

  // Bubble up error to console if url is invalid
  const url = new URL(url_string);

  const feed = await subscribe(session, iconn, url, options, 3000, true);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(session, iconn, poll_options, feed);
  }

  session.close();
  iconn.close();
}

async function cli_archive_entries(max_age) {
  // TODO: if max_age parameter is not set, try reading in the config value?
  const session = await db.open_with_channel();
  await archive_entries(session.conn, session.channel, max_age);
  session.close();
}

async function cli_refresh_icons() {
  const proms = [db.open_with_channel(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);
  await refresh_feed_icons(session, iconn);
  session.close();
  iconn.close();
}

async function cli_poll_feeds() {
  const proms = [db.open_with_channel(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);

  // TODO: poll-feeds need to use db-session instead of model-access, probably
  // going to forget in this refactoring pass

  const poll_options = {ignore_recency_check: true};
  await poll_feeds(session, iconn, poll_options);
  session.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const session = await db.open_with_channel();
  await remove_lost_entries(session.conn, session.channel);
  session.close();
}

async function cli_remove_orphans() {
  const session = await db.open_with_channel();
  await remove_orphaned_entries(session.conn, session.channel);
  session.close();
}

async function cli_lookup_favicon(url_string, cached) {
  let document, fetch_flag = true;
  const url = new URL(url_string);
  let conn;
  if (cached) {
    conn = await favicon.open();
  }
  const icon_url_string = await favicon.lookup(conn, url, document, fetch_flag);
  if (cached && conn) {
    conn.close();
  }

  return icon_url_string;
}

function cli_print_alarms() {
  chrome.alarms.getAll(alarms => {
    for (const alarm of alarms) {
      console.debug('Alarm:', alarm.name);
    }
  });
}

function cli_clear_alarms() {
  chrome.alarms.clearAll(cleared => {
    console.debug('Cleared all alarms');
  });
}

function cli_create_alarms() {
  cron_control.create_alarms();
  console.debug('Created alarms');
}

function cli_clear_icons() {
  return favicon.clear();
}

function cli_compact_icons() {
  return favicon.compact();
}

function cli_install_fonts() {
  config.install_fonts();
}

const cli = {
  create_alarms: cli_create_alarms,
  clear_alarms: cli_clear_alarms,
  print_alarms: cli_print_alarms,
  archive: cli_archive_entries,
  clear_icons: cli_clear_icons,
  compact_icons: cli_compact_icons,
  install_fonts: cli_install_fonts,
  remove_orphaned_entries: cli_remove_orphans,
  remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe
};

// Expose to console
window.cli = cli;
