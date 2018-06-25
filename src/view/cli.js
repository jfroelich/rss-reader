import {archive_entries} from '/src/control/archive-control.js';
import * as cron_control from '/src/control/cron-control.js';
import * as feed_entry_control from '/src/control/feed-entry-control.js';
import {subscribe} from '/src/control/subscribe.js';
import {ReaderDAL} from '/src/dal.js';
import * as favicon from '/src/control/favicon/favicon.js';
import {poll_feed, poll_feeds} from '/src/control/poll/poll-feeds.js';

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
  const dal = new ReaderDAL();
  const proms = [dal.connect(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);

  dal.channel = new BroadcastChannel(localStorage.channel_name);

  // Bubble up errors to console
  const url = new URL(url_string);
  const feed = await subscribe(dal, iconn, url, options, 3000, true);

  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(dal.conn, iconn, dal.channel, poll_options, feed);
  }

  dal.close();
  dal.channel.close();
  iconn.close();
}

async function cli_archive_entries() {
  const dal = new ReaderDAL();
  dal.channel = new BroadcastChannel(localStorage.channel_name);
  await dal.connect();
  await archive_entries(dal);
  dal.channel.close();
  dal.close();
}

async function cli_refresh_icons() {
  const dal = new ReaderDAL();
  const proms = [dal.connect(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel(localStorage.channel_name);
  await favicon.refresh_feeds(dal.conn, iconn, channel);
  dal.close();
  iconn.close();
  channel.close();
}

async function cli_poll_feeds() {
  const dal = new ReaderDAL();
  const proms = [dal.connect(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel(localStorage.channel_name);
  const options = {ignore_recency_check: true};
  await poll_feeds(dal.conn, iconn, channel, options);
  channel.close();
  dal.close();
  iconn.close();
}

async function cli_remove_lost_entries() {
  const dal = new ReaderDAL();
  await dal.connect();
  dal.channel = new MonitoredBroadcastChannel(localStorage.channel_name);
  await feed_entry_control.remove_lost_entries(dal);
  console.log('Removed %d lost entries', channel.message_count);
  dal.close();
  dal.channel.close();
}

async function cli_remove_orphans() {
  const dal = new ReaderDAL();
  await dal.connect();
  const channel = new MonitoredBroadcastChannel(localStorage.channel_name);
  await feed_entry_control.remove_orphaned_entries(dal.conn, channel);
  console.log('Deleted %d entries', channel.message_count);
  dal.close();
  channel.close();
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

// A proxy for a BroadcastChannel that logs each message to the console and
// keeps a count of sent messages.
class MonitoredBroadcastChannel {
  constructor(name) {
    this.channel = new BroadcastChannel(name);
    this.message_count = 0;
  }

  postMessage(message) {
    console.debug(message);
    this.channel.postMessage(message);
    this.message_count++;
  }

  close() {
    this.channel.close();
  }
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
