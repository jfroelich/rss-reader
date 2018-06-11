import {archive_entries} from '/src/archive.js';
import * as dbhealth from '/src/db-health.js';
import * as db from '/src/db.js';
import * as favicon from '/src/favicon.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';

async function cron_alarm_listener(alarm) {
  console.debug('Wakeup', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  if (alarm.name === 'archive') {
    const conn = await db.open_db();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await archive_entries(conn, channel);
    channel.close();
    conn.close();
  } else if (alarm.name === 'poll') {
    if (localStorage.ONLY_POLL_IF_IDLE) {
      // TODO: this value should come from local storage
      const idle_period_secs = 30;
      const state = await query_idle_state(idle_period_secs);
      if (state !== 'locked' || state !== 'idle') {
        return;
      }
    }

    const options = {};
    options.ignore_recency_check = false;
    options.notify = true;

    const rconn = await db.open_db();
    const iconn = await favicon.open();
    const channel = new BroadcastChannel(localStorage.channel_name);

    await poll_feeds(rconn, iconn, channel, options);

    channel.close();
    iconn.close();
    rconn.close();
  } else if (alarm.name === 'remove-entries-missing-urls') {
    const conn = await db.open_db();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await dbhealth.remove_lost_entries(conn, channel);
    conn.close();
    channel.close();
  } else if (alarm.name === 'remove-orphaned-entries') {
    const conn = await db.open_db();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await dbhealth.remove_orphaned_entries(conn, channel);
    conn.close();
    channel.close();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [db.open_db(), favicon.open()];
    const [rconn, iconn] = await Promise.all(proms);
    const channel = new BroadcastChannel(localStorage.channel_name);
    await favicon.refresh_feeds(rconn, iconn, channel);
    rconn.close();
    iconn.close();
    channel.close();
  } else if (alarm.name === 'compact-favicon-db') {
    await favicon.compact();
  } else if (alarm.name === 'cleanup-refresh-badge-lock') {
    // This is just a precaution that deletes the lock periodically, so that due
    // to error a user is not left with an unread count that permanently stops
    // updating. Now if it gets into bad state it will only last until this
    // alarm.
    delete localStorage.refresh_badge_cross_page_lock;
  } else {
    console.warn('Unhandled alarm', alarm.name);
  }
}

function query_idle_state(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

// TODO: do not bind on every page load somehow
chrome.alarms.onAlarm.addListener(cron_alarm_listener);

export function create_alarms() {
  chrome.alarms.create(
      'cleanup-refresh-badge-lock', {periodInMinutes: 60 * 12});
  chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
  chrome.alarms.create('poll', {periodInMinutes: 60});
  chrome.alarms.create(
      'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create(
      'db-remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create(
      'refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
  chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
}

// NOTE: previous_version is not currently in use, but it might be in the
// future, this might try and only remove alarms that were recently removed
// instead of always trying to remove all alarms
export function remove_legacy_alarms(previous_version) {
  const legacy_alarm_names = ['test-install-binding-alarms'];

  // See https://developer.chrome.com/extensions/alarms#method-clear

  function onclear(alarm_name, was_cleared) {
    if (was_cleared) {
      console.debug('Alarm removed:', alarm_name);
    } else {
      console.debug('Failed to clear alarm, alarm not found:', alarm_name);
    }
  }

  for (const alarm_name of legacy_alarm_names) {
    console.debug('Removing legacy alarm', alarm_name);
    chrome.alarms.clear(alarm_name, onclear.bind(null, alarm_name));
  }
}
