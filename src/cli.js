import * as config from '/src/config.js';
import * as cron from '/src/cron.js';
import * as db from '/src/db/db.js';
import {Deadline} from '/src/deadline/deadline.js';
import * as favicon from '/src/favicon/favicon.js';
import {poll_feeds, PollFeedsArgs} from '/src/poll-feeds/poll-feeds.js';
import refresh_feed_icons from '/src/refresh-feed-icons/refresh-feed-icons.js';
import subscribe from '/src/subscribe/subscribe.js';
import unsubscribe from '/src/unsubscribe/unsubscribe.js';

async function archive_resources_command() {
  console.log('Archiving resources...');
  const conn = await db.open();
  const resource_ids = await db.archive_resources(conn);
  conn.close();
  console.debug('Archived %d resources', resource_ids.length);
}

async function clear_alarms_command() {
  console.log('Clearing alarms...');
  const cleared = await clear_alarms();
  console.log('Cleared alarms (cleared=%s)', cleared);
}

function clear_alarms() {
  return new Promise(resolve => chrome.alarms.clearAll(resolve));
}

async function clear_favicons_command() {
  console.log('Clearing favicon cache...');
  const conn = await favicon.open();
  await favicon.clear(conn);
  conn.close();
  console.log('Cleared favicon cache');
}

async function compact_favicons_command() {
  console.log('Compacting favicon cache...');
  const conn = await favicon.open();
  await favicon.compact(conn);
  conn.close();
  console.log('Compacted favicon cache');
}

function create_alarms_command() {
  console.log('Creating alarms...');
  cron.create_alarms();
  console.log('Created alarms');
}

async function lookup_favicon_command(url_string, cached) {
  console.log('Looking up favicon for url', url_string);

  const request = new favicon.LookupRequest();
  request.conn = cached ? await favicon.open() : undefined;
  request.url = new URL(url_string);
  const result = await favicon.lookup(request);
  request.conn && request.conn.close();

  console.log('Lookup result:', result ? result.href : null);
}

async function poll_feeds_command() {
  console.log('Polling feeds...');

  const proms = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);

  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;

  // The user is expressing explicit intent to poll, so disregard whenever the
  // last poll ran.
  args.ignore_recency_check = true;

  await poll_feeds(args);
  conn.close();
  iconn.close();

  console.log('Poll completed');
}

async function print_alarms_command() {
  console.group('Enumerating alarms...');

  const alarms = await get_all_alarms();
  for (const alarm of alarms) {
    console.log('Alarm:', alarm.name);
  }

  console.groupEnd();
}

function get_all_alarms() {
  return new Promise(resolve => chrome.alarms.getAll(resolve));
}

async function refresh_favicons_command() {
  console.log('Refreshing favicons for feeds...');
  const proms = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const update_results = await refresh_feed_icons(conn, iconn);
  conn.close();
  iconn.close();
  console.log(
      'Completed refreshing favicons (%d inspected)', update_results.length);
}

// Add a new font to the registered font list
function register_font_command(new_font_name) {
  console.log('Registering font', new_font_name);

  const fonts = config.read_array('fonts');

  const normal_new_name = new_font_name.toLowerCase();

  for (const existing_font_name of fonts) {
    const normal_existing_name = existing_font_name.toLowerCase();
    if (normal_existing_name === normal_new_name) {
      console.warn(
          'Failed to register font %s. A similar font already exists.',
          new_font_name);
      return;
    }
  }

  fonts.push(new_font_name);
  config.write_array('fonts', fonts);
  console.log('Registered font', new_font_name);
}

async function subscribe_command(url_string) {
  console.log('Subscribing to url %s ...', url_string);

  const url = new URL(url_string);
  const timeout = new Deadline(3000);
  const notify = true;

  const callback = feed => {
    console.debug('Stored new feed, now storing entries...');
  };

  const proms = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const feed = await subscribe(conn, iconn, url, timeout, notify, callback);
  conn.close();
  iconn.close();

  console.log('Subscribed to feed', db.get_url_string(feed));
}

async function unsubscribe_command(url_string) {
  console.log('Unsubscribing from', url_string);

  const url = new URL(url_string);

  const conn = await db.open();

  // unsubscribe does not check whether the feed actually exists, but we want
  // to know if that is the case in order to provide more information.
  const feed = await db.get_resource(
      {conn: conn, mode: 'url', url: url, key_only: true});
  if (feed) {
    await unsubscribe(conn, feed.id);

    const info = {};
    info.url = url.href;
    info.id = feed.id;
    info.title = feed.title;

    console.log('Unsubscribed from feed', info);
  } else {
    console.warn('Not subscribed to feed', url.href);
  }

  conn.close();
}

const commands = {};
commands.archive_resources = archive_resources_command;
commands.clear_alarms = clear_alarms_command;
commands.clear_favicons = clear_favicons_command;
commands.compact_favicons = compact_favicons_command;
commands.create_alarms = create_alarms_command;
commands.install_fonts = register_font_command;
commands.lookup_favicon = lookup_favicon_command;
commands.poll_feeds = poll_feeds_command;
commands.print_alarms = print_alarms_command;
commands.refresh_favicons = refresh_favicons_command;
commands.subscribe = subscribe_command;
commands.unsubscribe = unsubscribe_command;

if (typeof window === 'object') {
  window.cli = commands;
} else {
  console.warn('reader command line interface unavailable, no window context');
}
