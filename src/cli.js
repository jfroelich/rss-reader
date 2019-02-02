import * as cdb from '/src/cdb.js';
import * as config from '/src/config-control.js';
import * as cron_control from '/src/cron.js';
import * as favicon from '/src/favicon.js';
import * as ops from '/src/ops.js';
import {PollOperation} from '/src/poll-feeds.js';

async function cli_subscribe(url_string, poll = true) {
  const url = new URL(url_string);
  const proms = [cdb.open(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);
  const feed = await ops.subscribe(session, iconn, url, options, 3000, true);
  // Do a sequential poll of the created feed
  if (poll) {
    const op = new PollOperation();
    op.session = session;
    op.iconn = iconn;
    op.ignore_recency_check = true;
    op.notify = true;
    await op.poll_feed(feed);
  }
  session.close();
  iconn.close();
}

async function cli_refresh_icons() {
  const proms = [cdb.open(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);
  await ops.refresh_feed_icons(session, iconn);
  session.close();
  iconn.close();
}

async function cli_poll_feeds() {
  const proms = [cdb.open(), favicon.open()];
  const [session, iconn] = await Promise.all(proms);

  const poll = new PollOperation();
  poll.session = session;
  poll.iconn = iconn;
  poll.ignore_recency_check = true;
  try {
    await poll.run();
  } catch (error) {
    console.error(error);
  }

  session.close();
  iconn.close();
}

async function cli_lookup_favicon(url_string, cached) {
  const request = new favicon.LookupRequest();
  request.conn = cached ? await favicon.open() : undefined;
  request.url = new URL(url_string);
  const result = await favicon.lookup(request);
  cached && request.conn && request.conn.close();
  return result;
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

async function cli_clear_icons() {
  const conn = await favicon.open();
  return favicon.clear(conn);
  conn.close();
}

async function cli_compact_icons() {
  const conn = await favicon.open();
  return favicon.compact(conn);
  conn.close();
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
