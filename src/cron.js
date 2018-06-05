import {archive_entries} from '/src/db/archive-entries.js';
import {open_feed_db} from '/src/db/open-feed-db.js';
import {remove_lost_entries} from '/src/db/remove-lost-entries.js';
import {remove_orphaned_entries} from '/src/db/remove-orphaned-entries.js';
import {favicon_compact, favicon_create_conn, favicon_refresh_feeds} from '/src/favicon.js';
import {log} from '/src/log.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';

// TODO: configurable cron settings?
// TODO: decouple from log module, just use console.log directly
// TODO: shove the on-load stuff into a function so that it is more configurable
// regarding when the binding occurs as opposed to being tightly coupled to the
// onload event? maybe even export it and have importing module call it, so that
// concern is shifted somewhere else? Or maybe the concern is fine to hide here?
// Part of the issue is also that onload stuff should not happen every module
// load, it should only happen on app update
// TODO: invent a method of cleaning up outdated alarms, because simply using
// a new name for an alarm does not de-register its old listener from Chrome

async function handle_compact_favicons_alarm(alarm) {
  await favicon_compact();
}

async function handle_archive_alarm_wakeup(alarm) {
  const conn = await open_feed_db();
  const channel = new BroadcastChannel(localStorage.channel_name);
  await archive_entries(conn, channel);
  channel.close();
  conn.close();
}

async function handle_lost_entries_alarm(alarm) {
  const op = {};
  op.conn = await open_feed_db();
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.remove_lost_entries = remove_lost_entries;
  await op.remove_lost_entries();
  op.conn.close();
  op.channel.close();
}

async function handle_orphan_entries_alarm(alarm) {
  const op = {};
  op.conn = await open_feed_db();
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.remove_orphaned_entries = remove_orphaned_entries;
  await op.remove_orphaned_entries();
  op.conn.close();
  op.channel.close();
}

async function handle_refresh_icons_alarm(alarm) {
  const proms = [open_feed_db(), favicon_create_conn()];
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

  const rconn = await open_feed_db();
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

chrome.alarms.onAlarm.addListener(function(alarm) {
  log('onalarm: alarm name', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch (alarm.name) {
    case 'archive':
      handle_archive_alarm_wakeup(alarm).catch(log);
      break;
    case 'poll':
      handle_poll_feeds_alarm(alarm).catch(log);
      break;
    case 'remove-entries-missing-urls':
      handle_lost_entries_alarm(alarm).catch(log);
      break;
    case 'remove-orphaned-entries':
      handle_orphan_entries_alarm(alarm).catch(log);
      break;
    case 'refresh-feed-icons':
      handle_refresh_icons_alarm(alarm).catch(log);
      break;
    case 'compact-favicon-db':
      handle_compact_favicons_alarm(alarm).catch(log);
      break;
    default:
      log('unhandled alarm', alarm.name);
      break;
  }
});

chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create(
    'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create(
    'db-remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
