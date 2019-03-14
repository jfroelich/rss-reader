import * as config from '/src/config/config.js';
import * as cron_control from '/src/cron.js';
import db_open from '/src/db/ops/db-open.js';
import get_feed from '/src/db/ops/get-feed.js';
import {Deadline} from '/src/deadline.js';
import * as favicon from '/src/favicon/favicon.js';
import {poll_feeds, PollFeedsArgs} from '/src/ops/poll-feeds.js';
import refresh_feed_icons from '/src/ops/refresh-feed-icons.js';
import {subscribe} from '/src/ops/subscribe.js';
import {unsubscribe} from '/src/ops/unsubscribe.js';

// TODO: add and implement cli_archive_entries

function clear_alarms() {
  return new Promise(resolve => chrome.alarms.clearAll(resolve));
}

function get_all_alarms() {
  return new Promise(resolve => chrome.alarms.getAll(resolve));
}

async function cli_subscribe(url_string) {
  const url = new URL(url_string);

  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');

  const callback = feed => {
    console.debug('Stored new feed, now storing entries...');
  };

  const timeout = new Deadline(3000);
  const notify = true;
  const feed =
      await subscribe(conn, iconn, channel, url, timeout, notify, callback);

  channel.close();
  conn.close();
  iconn.close();

  console.log('Successfully subscribed to feed', feed.getURLString());
}

async function cli_unsubscribe(url_string) {
  console.log('Unsubscribing from', url_string);
  const url = new URL(url_string);

  const conn = await db_open();
  const channel = new BroadcastChannel('reader');

  const feed = await get_feed(conn, 'url', url, true);
  if (feed) {
    await unsubscribe(conn, channel, feed.id);
    console.log(
        'Unsubscribed from feed %s {id: %d, title: %s}', url.href, feed.id,
        feed.title);
  } else {
    console.warn(
        'Unsubscribe failed. You are not subscribed to the feed', url.href);
  }

  conn.close();
  channel.close();
}

async function cli_refresh_icons() {
  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');
  await refresh_feed_icons(conn, iconn, channel);
  conn.close();
  iconn.close();
  channel.close();
}

async function cli_poll_feeds() {
  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');

  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.channel = channel;
  args.ignore_recency_check = true;
  await poll_feeds(args);
  conn.close();
  iconn.close();
  channel.close();
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
  const alarms = await get_all_alarms();
  for (const alarm of alarms) {
    console.log('Alarm:', alarm.name);
  }
}

async function cli_clear_alarms() {
  console.log('Clearing alarms...');
  const cleared = await clear_alarms();
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
  subscribe: cli_subscribe,
  unsubscribe: cli_unsubscribe
};

window.cli = cli;
