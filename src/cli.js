import * as config from '/src/config-control.js';
import * as cron_control from '/src/cron.js';
import * as favicon from '/src/favicon/favicon-control.js';
import {poll_feed, poll_feeds} from '/src/poll/poll-feeds.js';
import {refresh_feed_icons, subscribe} from '/src/ops.js';
import * as db from '/src/db/db.js';

async function cli_subscribe(url_string, poll = true) {
  const url = new URL(url_string);
  const proms = [db.open_with_channel(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);
  const feed = await subscribe(session, iconn, url, options, 3000, true);
  // Do a sequential poll of the created feed
  if (poll) {
    const poll_options = {ignore_recency_check: true, notify: true};
    await poll_feed(session, iconn, poll_options, feed);
  }
  session.close();
  iconn.close();
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
  const poll_options = {ignore_recency_check: true};
  await poll_feeds(session, iconn, poll_options);
  session.close();
  iconn.close();
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
  clear_icons: cli_clear_icons,
  compact_icons: cli_compact_icons,
  install_fonts: cli_install_fonts,
  lookup_favicon: cli_lookup_favicon,
  poll_feeds: cli_poll_feeds,
  refresh_icons: cli_refresh_icons,
  subscribe: cli_subscribe
};

window.cli = cli;
