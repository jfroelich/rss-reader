import * as favicon from '/src/action/favicon/favicon.js';
import {poll_feed, poll_feeds} from '/src/action/poll/poll-feeds.js';
import {subscribe} from '/src/action/subscribe.js';
import * as cron_control from '/src/control/cron-control.js';
import {openModelAccess} from '/src/model/model-access.js';

// The command-line-interface (CLI) module creates a cli object within the
// global window object in order to make certain app functionality accessible
// via the browser's console. This module is not intended for use by testing
// modules or to be called by other code so it does not export anything.
//
// The cli exists because:
// * it provides direct developer access to functions
// * it is more stable than the view (for now)
// * it leads to better design by providing a calling context other than normal
// dom event handlers in an html view, which helps avoid view-dependent code
// from appearing where it should not
// * it ensures headless support
// * hacky testing convenience
// * another way of saying this, is that I am trying to keep separation between
// model and view. Having a second style of view ensures that important model
// things do not end up in the view. For a refresher review the following
// article: http://read.humanjavascript.com/ch04-organizing-your-code.html

async function cli_subscribe(url_string, poll = true) {
  const proms = [openModelAccess(/* channeled */ true), favicon.open()];
  const [ma, iconn] = await Promise.all(proms);

  // Bubble up errors to console
  const url = new URL(url_string);
  const feed = await subscribe(ma, iconn, url, options, 3000, true);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(ma.conn, iconn, ma.channel, poll_options, feed);
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
  await favicon.refresh_feeds(ma, iconn);
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

window.cli = cli;  // expose to console
