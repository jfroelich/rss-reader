import {archive_entries} from '/src/archive.js';
import {favicon_compact, favicon_create_conn, favicon_refresh_feeds} from '/src/favicon.js';
import {remove_lost_entries} from '/src/health/remove-lost-entries.js';
import {remove_orphaned_entries} from '/src/health/remove-orphaned-entries.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {open_reader_db} from '/src/reader-db.js';

async function handle_compact_favicons_alarm(alarm) {
  await favicon_compact();
}

async function handle_archive_alarm_wakeup(alarm) {
  const conn = await open_reader_db();
  const channel = new BroadcastChannel(localStorage.channel_name);
  await archive_entries(conn, channel);
  channel.close();
  conn.close();
}

async function handle_lost_entries_alarm(alarm) {
  const conn = await open_reader_db();
  const channel = new BroadcastChannel(localStorage.channel_name);
  await remove_lost_entries(conn, channel);
  conn.close();
  channel.close();
}

async function handle_orphan_entries_alarm(alarm) {
  const conn = await open_reader_db();
  const channel = new BroadcastChannel(localStorage.channel_name);
  await remove_orphaned_entries(conn, channel);
  conn.close();
  channel.close();
}

async function handle_refresh_icons_alarm(alarm) {
  const proms = [open_reader_db(), favicon_create_conn()];
  const [rconn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel(localStorage.channel_name);

  const op = {};
  op.rconn = rconn;
  op.iconn = iconn;
  op.channel = channel;
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

  const rconn = await open_reader_db();
  const iconn = await favicon_create_conn();
  const channel = new BroadcastChannel(localStorage.channel_name);

  await poll_feeds(rconn, iconn, channel, options);

  channel.close();
  iconn.close();
  rconn.close();
}

function query_idle_state(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

// This is just a precaution that deletes the lock periodically, so that due to
// error a user is not left with an unread count that permanently stops
// updating. Now if it gets into bad state it will only last until this alarm.
function handle_cleanup_refresh_badge_lock(alarm) {
  delete localStorage.refresh_badge_cross_page_lock;
}

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Wakeup', alarm.name);
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
      handle_refresh_icons_alarm(alarm).catch(console.error);
      break;
    case 'compact-favicon-db':
      handle_compact_favicons_alarm(alarm).catch(console.error);
      break;
    case 'cleanup-refresh-badge-lock':
      handle_cleanup_refresh_badge_lock(alarm);
    default:
      console.warn('Unhandled alarm', alarm.name);
      break;
  }
});

chrome.alarms.create('cleanup-refresh-badge-lock', {periodInMinutes: 60 * 12});
chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create(
    'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create(
    'db-remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
