import * as config from '/src/control/config.js';
import * as cron_control from '/src/control/cron.js';
import * as favicon from '/src/lib/favicon.js';
import * as platform from '/src/lib/platform.js';
import {Model} from '/src/model/model.js';
import {PollOperation} from '/src/ops/poll-feeds/poll-feeds.js';
import {refresh_feed_icons} from '/src/ops/refresh-feed-icons.js';
import {subscribe} from '/src/ops/subscribe.js';

// TODO: add and implement cli_archive_entries

async function cli_subscribe(url_string, fetch_entries = true) {
  const url = new URL(url_string);
  const session = new Model();

  const proms = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);
  const feed = await subscribe(session, iconn, url, options, 3000, true);
  if (fetch_entries) {
    const op = new PollOperation();
    op.session = session;
    op.iconn = iconn;
    op.ignore_recency_check = true;
    op.notify = true;
    await op.pollFeed(feed);
  }
  session.close();
  iconn.close();
}

async function cli_refresh_icons() {
  const session = new Model();
  const proms = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);
  await refresh_feed_icons(session, iconn);
  session.close();
  iconn.close();
}

async function cli_poll_feeds() {
  const session = new Model();
  const proms = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(proms);
  const poll = new PollOperation();
  poll.session = session;
  poll.iconn = iconn;
  poll.ignore_recency_check = true;
  await poll.run();
  session.close();
  iconn.close();
}

async function cli_lookup_favicon(url_string, cached) {
  const request = new favicon.LookupRequest();
  request.conn = cached ? await favicon.open() : undefined;
  request.url = new URL(url_string);
  const result = await favicon.lookup(request);
  request.conn && request.conn.close();
  return result ? result.href : undefined;
}

async function cli_print_alarms() {
  console.log('Enumerating alarms...');
  const alarms = await platform.alarm.get_all();
  for (const alarm of alarms) {
    console.log('Alarm:', alarm.name);
  }
}

async function cli_clear_alarms() {
  console.log('Clearing alarms...');
  const cleared = await platform.alarm.clear();
  console.log('Cleared alarms');
}

function cli_create_alarms() {
  cron_control.create_alarms();
  console.log('Created alarms');
}

async function cli_clear_icons() {
  console.log('Clearing favicon cache...');
  const conn = await favicon.open();
  await favicon.clear(conn);
  conn.close();
  console.log('Cleared favicon cache');
}

async function cli_compact_icons() {
  console.log('Compacting favicon cache...');
  const conn = await favicon.open();
  await favicon.compact(conn);
  conn.close();
  console.log('Compacted favicon cache');
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
