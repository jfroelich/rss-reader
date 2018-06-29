import * as favicon from '/src/action/favicon/favicon.js';
import {poll_feeds} from '/src/action/poll/poll-feeds.js';
import * as ls from '/src/lib/ls.js';
import ModelAccess from '/src/model/model-access.js';
import * as model_health from '/src/model/model-health.js';

// Appropriately modify alarm settings when the extension is installed or
// updated
export function install_listener(event) {
  // Of the reasons, if we are not installing, we are doing some kind of update
  // and do not care which subtype, and all reasons other than install are
  // update per the chrome api docs
  if (event.reason === 'install') {
    create_alarms();
  } else {
    const previous_version_string = event.previousVersion;
    update_alarms(previous_version_string);
  }
}

export async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  ls.write_string('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const ma = new ModelAccess();
    await ma.connect(/* writable */ true);
    await ma.archiveEntries();
    ma.close();
  } else if (alarm.name === 'poll') {
    if (ls.read_boolean('only_poll_if_idle')) {
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
    const ma = new ModelAccess();
    await ma.connect(/* writable */ true);
    const iconn = await favicon.open();
    // TODO: should just be passing around ma
    await poll_feeds(ma.conn, iconn, ma.channel, options);
    iconn.close();
    ma.close();
  } else if (alarm.name === 'remove-entries-missing-urls') {
    const ma = new ModelAccess();
    await ma.connect(/* writable */ true);
    await model_health.remove_lost_entries(ma);
    ma.close();
  } else if (alarm.name === 'remove-orphaned-entries') {
    const ma = new ModelAccess();
    await ma.connect(/* writable */ true);
    // TODO: should just be passing around ma
    await model_health.remove_orphaned_entries(ma.conn, ma.channel);
    ma.close();
  } else if (alarm.name === 'remove-untyped-objects') {
    const ma = new ModelAccess();
    await ma.connect(/* writable */ true);
    // TODO: should just be passing around ma
    await model_health.remove_untyped_objects(ma.conn, ma.channel);
    ma.close();
  } else if (alarm.name === 'refresh-feed-icons') {
    const ma = new ModelAccess();
    const proms = [ma.connect(/* writable */ true), favicon.open()];
    const [_, iconn] = await Promise.all(proms);

    // TODO: should just be passing around ma
    await favicon.refresh_feeds(ma.conn, iconn, ma.channel);
    ma.close();
    iconn.close();
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

// TODO: switch to cross browser idle state query, see
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/idle/queryState

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
