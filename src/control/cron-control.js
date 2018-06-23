import {archive_entries} from '/src/control/archive-control.js';
import * as entry_control from '/src/control/entry-control.js';
import * as feed_entry_control from '/src/control/feed-entry-control.js';
import {ReaderDAL} from '/src/dal.js';
import * as favicon from '/src/favicon/favicon.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';

export function register_listener() {
  chrome.alarms.onAlarm.addListener(alarm_listener);
}

async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  localStorage.last_alarm = alarm.name;

  if (alarm.name === 'archive') {
    const dal = new ReaderDAL();
    dal.channel = new BroadcastChannel(localStorage.channel_name);
    await dal.connect();
    await archive_entries(dal);
    dal.channel.close();
    dal.close();
  } else if (alarm.name === 'poll') {
    if (localStorage.ONLY_POLL_IF_IDLE) {
      // TODO: this value should come from local storage
      const idle_secs = 30;
      const state = await query_idle_state(idle_secs);
      if (state !== 'locked' || state !== 'idle') {
        return;
      }
    }

    const options = {};
    options.ignore_recency_check = false;
    options.notify = true;
    const dal = new ReaderDAL();
    await dal.connect();
    const iconn = await favicon.open();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await poll_feeds(dal.conn, iconn, channel, options);
    channel.close();
    iconn.close();
    dal.close();
  } else if (alarm.name === 'remove-entries-missing-urls') {
    const dal = new ReaderDAL();
    await dal.connect();
    dal.channel = new BroadcastChannel(localStorage.channel_name);
    await entry_control.remove_lost_entries(dal);
    dal.close();
    dal.channel.close();
  } else if (alarm.name === 'remove-orphaned-entries') {
    const dal = new ReaderDAL();
    await dal.connect();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await feed_entry_control.remove_orphaned_entries(dal.conn, channel);
    dal.close();
    channel.close();
  } else if (alarm.name === 'remove-untyped-objects') {
    const dal = new ReaderDAL();
    await dal.connect();
    const channel = new BroadcastChannel(localStorage.channel_name);
    await feed_entry_control.remove_untyped_objects(dal.conn, channel);
    dal.close();
    channel.close();
  } else if (alarm.name === 'refresh-feed-icons') {
    const dal = new ReaderDAL();
    const proms = [dal.connect(), favicon.open()];
    const [_, iconn] = await Promise.all(proms);
    const channel = new BroadcastChannel(localStorage.channel_name);
    await favicon.refresh_feeds(dal.conn, iconn, channel);
    dal.close();
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

function query_idle_state(idle_secs) {
  return new Promise(res => chrome.idle.queryState(idle_secs, res));
}

export function update_alarms(prev_version_string) {
  remove_legacy_alarms(prev_version_string);

  // currently does not do much else, but probably will in the future
}

export function create_alarms() {
  chrome.alarms.create(
      'cleanup-refresh-badge-lock', {periodInMinutes: 60 * 12});
  chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
  chrome.alarms.create('poll', {periodInMinutes: 60});
  chrome.alarms.create(
      'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create(
      'remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create(
      'remove-untyped-objects', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create(
      'refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
  chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
}

export function remove_legacy_alarms(previous_version) {
  const legacy_alarm_names =
      ['test-install-binding-alarms', 'db-remove-orphaned-entries'];
  // See https://developer.chrome.com/extensions/alarms#method-clear
  for (const alarm_name of legacy_alarm_names) {
    chrome.alarms.clear(alarm_name, on_remove_alarm.bind(null, alarm_name));
  }
}

function on_remove_alarm(alarm_name, was_cleared) {
  if (was_cleared) {
    console.log('Removed alarm', alarm_name);
  }
}
