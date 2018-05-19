import '/src/cli.js';

import {refresh_badge} from '/src/badge.js';
import {config_channel_name} from '/src/config.js';
import {db_archive_entries} from '/src/db/db-archive-entries.js';
import {db_open} from '/src/db/db-open.js';
import {db_remove_lost_entries} from '/src/db/db-remove-lost-entries.js';
import {db_remove_orphaned_entries} from '/src/db/db-remove-orphaned-entries.js';
import {favicon_compact, favicon_create_conn, favicon_refresh_feeds} from '/src/favicon.js';
import {console_stub} from '/src/lib/console-stub.js';
import {open_view} from '/src/open-view.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';

async function handle_compact_favicons_alarm(alarm) {
  await favicon_compact();
}

async function handle_archive_alarm_wakeup(alarm) {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(config_channel_name);
  op.console = console_stub;
  op.db_archive_entries = db_archive_entries;
  let max_age;
  await op.db_archive_entries(max_age);
  op.channel.close();
  op.conn.close();
}

async function handle_lost_entries_alarm(alarm) {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(config_channel_name);
  op.console = console_stub;
  op.db_remove_lost_entries = db_remove_lost_entries;
  await op.db_remove_lost_entries();
  op.conn.close();
  op.channel.close();
}

async function handle_orphan_entries_alarm(alarm) {
  const op = {};
  op.conn = await db_open();
  op.channel = new BroadcastChannel(config_channel_name);
  op.console = console_stub;
  op.db_remove_orphaned_entries = db_remove_orphaned_entries;
  await op.db_remove_orphaned_entries();
  op.conn.close();
  op.channel.close();
}

async function handle_refresh_icons_alarm(alarm) {
  const proms = [db_open(), favicon_create_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel(config_channel_name);

  const op = {};
  op.rconn = rconn;
  op.iconn = iconn;
  op.channel = channel;
  op.console = console_stub;
  op.favicon_refresh_feeds = favicon_refresh_feeds;
  await op.favicon_refresh_feeds();

  rconn.close();
  iconn.close();
  channel.close();
}

async function handle_poll_feeds_alarm(alarm) {
  if ('ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    const state = await query_idle_state(idle_period_secs);
    if (state !== 'locked' || state !== 'idle') {
      return;
    }
  }

  const options = {};
  options.ignore_recency_check = false;
  options.notify = true;

  const rconn = await db_open();
  const iconn = await favicon_create_conn();
  const channel = new BroadcastChannel(config_channel_name);

  await poll_feeds(rconn, iconn, channel, console, options);

  channel.close();
  iconn.close();
  rconn.close();
}

function query_idle_state(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(async function(event) {
  let conn = await db_open();
  conn.close();

  conn = await favicon_create_conn();
  conn.close();
});

chrome.browserAction.onClicked.addListener(open_view);

async function badge_init() {
  const conn = await db_open();
  refresh_badge(conn, void console);
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
    case 'db-remove-orphaned-entries':
      handle_orphan_entries_alarm(alarm).catch(console.error);
      break;
    case 'refresh-feed-icons':
      handle_refresh_icons_alarm(alarm).catch(console.error);
      break;
    case 'compact-favicon-db':
      handle_compact_favicons_alarm(alarm).catch(console.error);
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
chrome.alarms.create('db-remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
