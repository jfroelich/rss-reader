import '/src/view/cli/cli.js';
import {rdr_conn_create} from '/src/app/handles/rdr-conn.js';
import {refresh_feed_icons} from '/src/app/operations/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/app/operations/remove-lost-entries.js';
import {remove_orphans} from '/src/app/operations/remove-orphaned-entries.js';
import {Archiver} from '/src/archive-entries.js';
import * as badge from '/src/badge.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import {PollService} from '/src/poll-service/poll-service.js';
import show_slideshow_tab from '/src/show-slideshow-tab.js';

async function handle_compact_favicons_alarm(alarm) {
  const service = new FaviconService();
  const conn = await service.open();
  service.conn = conn;
  await service.compact();
  conn.close();
}

async function handle_archive_alarm_wakeup(alarm) {
  const arch = new Archiver();
  await arch.open();
  await arch.archive();
  arch.close();
}

async function handle_lost_entries_alarm(alarm) {
  const channel = new BroadcastChannel('reader');
  const conn = await rdr_conn_create();
  let null_console = undefined;
  await remove_lost_entries(conn, channel, null_console);
  channel.close();
  conn.close();
}

async function handle_orphan_entries_alarm(alarm) {
  const conn = await rdr_conn_create();
  const channel = new BroadcastChannel('reader');
  await remove_orphans(conn, channel);
  channel.close();
  conn.close();
}

async function handle_refresh_feed_icons_alarm(alarm) {
  let channel;
  const fs = new FaviconService();
  const [rconn, iconn] = await Promise.all([rdr_conn_create(), fs.open()]);
  fs.conn = iconn;
  await refresh_feed_icons(rconn, fs, channel);
  rconn.close();
  iconn.close();
}

async function handle_poll_feeds_alarm(alarm) {
  if ('ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    const state = await query_idle_state(idle_period_secs);
    if (state !== 'locked' || state !== 'idle') {
      return;
    }
  }

  const service = new PollService();
  service.console = console;
  await service.init();
  await service.poll_feeds();
  service.close();
}

window.test_handle_poll_feeds_alarm = handle_poll_feeds_alarm;

function query_idle_state(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(async function(event) {
  let conn = await rdr_conn_create();
  conn.close();

  const fs = new FaviconService();
  fs.console = console;
  conn = await fs.open();
  conn.close();
});

chrome.browserAction.onClicked.addListener(show_slideshow_tab);

async function badge_init() {
  const conn = await rdr_conn_create();
  await badge.update(conn);
  conn.close();
}

badge_init();

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Alarm awoke:', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch (alarm.name) {
    case 'archive':
      handle_archive_alarm_wakeup(alarm).catch(console.error);
      break;
    case 'poll':
      handle_poll_feeds_alarm(alarm).catch(console.error);
      break;
    case 'remove-entries-missing-urls':
      handle_lost_entries_alarm(alarm).catch(console.error);
      break;
    case 'remove-orphaned-entries':
      handle_orphan_entries_alarm(alarm).catch(console.error);
      break;
    case 'refresh-feed-icons':
      handle_refresh_feed_icons_alarm(alarm).catch(console.error);
      break;
    case 'compact-favicon-db':
      handle_compact_favicons_alarm(alarm);
      break;
    default:
      console.warn('unhandled alarm', alarm.name);
      break;
  }
});

chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create(
    'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
