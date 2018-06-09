import {archive_entries} from '/src/archive.js';
import {remove_lost_entries, remove_orphaned_entries} from '/src/db-health.js';
import {favicon_compact, favicon_create_conn, favicon_refresh_feeds} from '/src/favicon.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {open_reader_db} from '/src/reader-db.js';

async function cron_alarm_listener(alarm) {
  console.debug('Wakeup', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  if (alarm.name === 'archive') {
    const conn = await open_reader_db();
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

    const rconn = await open_reader_db();
    const iconn = await favicon_create_conn();
    const channel = new BroadcastChannel(localStorage.channel_name);

    await poll_feeds(rconn, iconn, channel, options);

    channel.close();
    iconn.close();
    rconn.close();
  } else if (alarm.name === 'remove-entries-missing-urls') {
    const conn = await open_reader_db();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await remove_lost_entries(conn, channel);
    conn.close();
    channel.close();
  } else if (alarm.name === 'remove-orphaned-entries') {
    const conn = await open_reader_db();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await remove_orphaned_entries(conn, channel);
    conn.close();
    channel.close();
  } else if (alarm.name === 'refresh-feed-icons') {
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
  } else if (alarm.name === 'compact-favicon-db') {
    await favicon_compact();
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

chrome.alarms.create('cleanup-refresh-badge-lock', {periodInMinutes: 60 * 12});
chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create(
    'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create(
    'db-remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
