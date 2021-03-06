import * as DBService from '/src/service/db-service.js';
import * as favicon from '/src/lib/favicon.js';
import * as localStorageUtils from '/src/lib/local-storage-utils.js';
import { Deadline } from '/src/lib/deadline.js';
import { PollFeedsArgs, pollFeeds } from '/src/service/poll-feeds.js';
import CronControl from '/src/control/cron-control.js';
import archiveResources from '/src/service/archive-resources.js';
import refreshFeedIcons from '/src/service/refresh-feed-icons.js';
import subscribe from '/src/service/subscribe.js';
import unsubscribe from '/src/service/unsubscribe.js';

function clearAlarms() {
  return new Promise(resolve => chrome.alarms.clearAll(resolve));
}

function getAllAlarms() {
  return new Promise(resolve => chrome.alarms.getAll(resolve));
}

async function archiveResourcesCommand() {
  console.log('Archiving resources...');
  const conn = await DBService.open();
  const resourceIds = await archiveResources(conn);
  conn.close();
  console.debug('Archived %d resources', resourceIds.length);
}

async function clearAlarmsCommand() {
  console.log('Clearing alarms...');
  const cleared = await clearAlarms();
  console.log('Cleared alarms (cleared=%s)', cleared);
}

async function clearFaviconsCommand() {
  console.log('Clearing favicon cache...');
  const conn = await favicon.open();
  await favicon.clear(conn);
  conn.close();
  console.log('Cleared favicon cache');
}

async function compactFaviconsCommand() {
  console.log('Compacting favicon cache...');
  const conn = await favicon.open();
  await favicon.compact(conn);
  conn.close();
  console.log('Compacted favicon cache');
}

function createAlarmsCommand() {
  console.log('Creating alarms...');
  const cronControl = new CronControl();
  cronControl.createAlarms();
  console.log('Created alarms');
}

async function lookupFaviconCommand(urlString, cached) {
  console.log('Looking up favicon for url', urlString);

  const request = new favicon.LookupRequest();
  request.conn = cached ? await favicon.open() : undefined;
  request.url = new URL(urlString);
  const result = await favicon.lookup(request);

  if (request.conn) {
    request.conn.close();
  }

  console.log('Lookup result:', result ? result.href : null);
}

async function pollFeedsCommand() {
  console.log('Polling feeds...');

  const proms = [DBService.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);

  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;

  // The user is expressing explicit intent to poll, so disregard whenever the last poll ran.
  args.ignoreRecencyCheck = true;

  await pollFeeds(args);
  conn.close();
  iconn.close();

  console.log('Poll completed');
}

async function printAlarmsCommand() {
  console.group('Enumerating alarms...');

  const alarms = await getAllAlarms();
  for (const alarm of alarms) {
    console.log('Alarm:', alarm.name);
  }

  console.groupEnd();
}

async function refreshFaviconsCommand() {
  console.log('Refreshing favicons for feeds...');
  const proms = [DBService.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const updateResults = await refreshFeedIcons(conn, iconn);
  conn.close();
  iconn.close();
  console.log('Completed refreshing favicons (%d inspected)', updateResults.length);
}

// Add a new font to the registered font list
function registerFontCommand(newFontName) {
  console.log('Registering font', newFontName);

  const fonts = localStorageUtils.readArray('fonts');

  const normalizedNewFontName = newFontName.toLowerCase();

  for (const existingFontName of fonts) {
    const normalizedExistingFontName = existingFontName.toLowerCase();
    if (normalizedExistingFontName === normalizedNewFontName) {
      console.warn('Failed to register font %s. A similar font already exists.', newFontName);
      return;
    }
  }

  fonts.push(newFontName);
  localStorageUtils.writeArray('fonts', fonts);
  console.log('Registered font', newFontName);
}

async function subscribeCommand(urlString) {
  console.log('Subscribing to url %s ...', urlString);

  const url = new URL(urlString);
  const timeout = new Deadline(3000);
  const notify = true;

  function callback() {
    console.debug('Stored new feed, now storing entries...');
  }

  const proms = [DBService.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const feed = await subscribe(conn, iconn, url, timeout, notify, callback);
  conn.close();
  iconn.close();

  const currentURLString = feed.urls[feed.urls.length - 1];
  console.log('Subscribed to feed', currentURLString);
}

async function unsubscribeCommand(urlString) {
  console.log('Unsubscribing from', urlString);

  const url = new URL(urlString);

  const conn = await DBService.open();

  // unsubscribe does not check whether the feed actually exists, but we want to know if that is the
  // case in order to provide more information.
  const feed = await DBService.getFeed(conn, { mode: 'url', url, keyOnly: true });

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
commands.archiveResources = archiveResourcesCommand;
commands.clearAlarms = clearAlarmsCommand;
commands.clearFavicons = clearFaviconsCommand;
commands.compactFavicons = compactFaviconsCommand;
commands.createAlarms = createAlarmsCommand;
commands.installFonts = registerFontCommand;
commands.lookupFavicon = lookupFaviconCommand;
commands.pollFeeds = pollFeedsCommand;
commands.printAlarms = printAlarmsCommand;
commands.refreshFavicons = refreshFaviconsCommand;
commands.subscribe = subscribeCommand;
commands.unsubscribe = unsubscribeCommand;

if (typeof window === 'object') {
  window.cli = commands;
} else {
  console.warn('reader command line interface unavailable, no window context');
}
