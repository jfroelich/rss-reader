import * as cron_control from '/src/cron.js';
import * as favicon from '/src/favicon.js';
import {openModelAccess} from '/src/model/model-access.js';
import {poll_feed, poll_feeds} from '/src/poll/poll-feeds.js';
import {refresh_feed_icons} from '/src/refresh-feed-icons.js';
import {subscribe} from '/src/subscribe.js';

// Handle commands entered into the console.

async function cli_subscribe(url_string, poll = true) {
  const proms = [openModelAccess(/* channeled */ true), favicon.open()];
  const [ma, iconn] = await Promise.all(proms);

  // Bubble up errors to console
  const url = new URL(url_string);
  const feed = await subscribe(ma, iconn, url, options, 3000, true);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(ma, iconn, poll_options, feed);
  }

  ma.close();
  iconn.close();
}

async function cli_archive_entries() {
  const ma = await openModelAccess(/* channeled */ true);
  await ma.archiveEntries();
  ma.close();
}

async function cli_refresh_icons() {
  const proms = [openModelAccess(/* channeled */ true), favicon.open()];
  const [ma, iconn] = await Promise.all(proms);
  await refresh_feed_icons(ma, iconn);
  ma.close();
  iconn.close();
}

async function cli_poll_feeds() {
  const proms = [openModelAccess(/* channeled */ true), favicon.open()];
  const [ma, iconn] = await Promise.all(proms);
  await poll_feeds(ma, iconn, {ignore_recency_check: true});
  ma.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const ma = await openModelAccess(/* channeled */ true);
  await ma.removeLostEntries();
  ma.close();
}

async function cli_remove_orphans() {
  const ma = await openModelAccess(/* channeled */ true);
  await ma.removeOrphanedEntries();
  ma.close();
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

const cli = {
  create_alarms: cli_create_alarms,
  clear_alarms: cli_clear_alarms,
  print_alarms: cli_print_alarms,
  archive: cli_archive_entries,
  clear_icons: cli_clear_icons,
  compact_icons: cli_compact_icons,
  remove_orphaned_entries: cli_remove_orphans,
  remove_lost_entries: cli_remove_lost_entries,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe
};

// Expose to console
window.cli = cli;
