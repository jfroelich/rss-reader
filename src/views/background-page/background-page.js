import '/src/views/cli/cli.js';
import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';
import {archive_entries} from '/src/ops/archive-entries.js';
import {refresh_badge} from '/src/ops/refresh-badge.js';
import {create_channel} from '/src/ops/create-channel.js';
import {create_conn} from '/src/ops/create-conn.js';
import {create_icon_conn} from '/src/ops/create-icon-conn.js';
import {open_view} from '/src/ops/open-view.js';
import {poll_feeds} from '/src/ops/poll-feeds.js';
import {refresh_feed_icons} from '/src/ops/refresh-feed-icons.js';
import {remove_lost_entries} from '/src/ops/remove-lost-entries.js';
import {remove_orphans} from '/src/ops/remove-orphaned-entries.js';

async function handle_compact_favicons_alarm(alarm) {
  const conn = await create_icon_conn();
  const service = new FaviconService();
  service.conn = conn;
  await service.compact();
  conn.close();
}

async function handle_archive_alarm_wakeup(alarm) {
  const ac = {};
  ac.conn = await create_conn();
  ac.channel = create_channel();
  ac.console = console_stub;

  let max_age;

  await archive_entries.call(ac, max_age);
  ac.channel.close();
  ac.conn.close();
}

async function handle_lost_entries_alarm(alarm) {
  const channel = create_channel();
  const conn = await create_conn();
  await remove_lost_entries(conn, channel, void console);
  channel.close();
  conn.close();
}

async function handle_orphan_entries_alarm(alarm) {
  const channel = create_channel();
  const conn = await create_conn();
  await remove_orphans(conn, channel, void console);
  channel.close();
  conn.close();
}

async function handle_refresh_feed_icons_alarm(alarm) {
  const channel = create_channel();
  const proms = [create_conn(), create_icon_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  await refresh_feed_icons(rconn, iconn, channel, void console);
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

  const rconn = await create_conn();
  const iconn = await create_icon_conn();
  const channel = create_channel();

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
  let conn = await create_conn();
  conn.close();

  conn = await create_icon_conn();
  conn.close();
});

chrome.browserAction.onClicked.addListener(open_view);

async function badge_init() {
  const conn = await create_conn();
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
