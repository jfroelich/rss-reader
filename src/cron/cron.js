import * as config from '/src/config/config.js';
import * as favicon from '/src/favicon-service/favicon-control.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {refresh_feed_icons} from '/src/feed-favicon/refresh-feed-icons.js';
import * as db from '/src/db/db.js';

// Periods are in minutes to easily align with Chrome createAlarm param
const PERIOD_HALF_DAY = 60 * 12;
const PERIOD_ONE_WEEK = 60 * 24 * 7;

const alarms = [
  {name: 'cleanup-refresh-badge-lock', period: PERIOD_HALF_DAY},
  {name: 'archive', period: PERIOD_HALF_DAY},
  {name: 'remove-entries-missing-urls', period: PERIOD_ONE_WEEK},
  {name: 'poll', period: PERIOD_ONE_WEEK},
  {name: 'remove-orphaned-entries', period: PERIOD_ONE_WEEK},
  {name: 'remove-untyped-objects', period: PERIOD_ONE_WEEK},
  {name: 'refresh-feed-icons', period: PERIOD_ONE_WEEK * 2},
  {name: 'compact-favicon-db', period: PERIOD_ONE_WEEK},
  {name: 'test-install-binding-alarms', deprecated: true},
  {name: 'db-remove-orphaned-entries', deprecated: true}
];

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
  config.write_string('last_alarm', alarm.name);

  // TODO: these branches could probably all share the session open and close?

  if (alarm.name === 'archive') {
    // TODO: read max age from config instead of defaulting
    let max_age;
    const session = await db.open_with_channel();
    await db.archive_entries(session, max_age);
    session.close();
  } else if (alarm.name === 'poll') {
    if (config.read_boolean('only_poll_if_idle')) {
      // TODO: this value should come from configuration
      const idle_secs = 30;
      const state = await query_idle_state(idle_secs);
      if (state !== 'locked' || state !== 'idle') {
        return;
      }
    }

    const promises = [db.open_with_channel(), favicon.open()];
    const [session, iconn] = await Promise.all(promises);
    const poll_options = {ignore_recency_check: false, notify: true};
    await poll_feeds(session, iconn, poll_options);
    session.close();
    iconn.close();
  } else if (alarm.name === 'remove-entries-missing-urls') {
    const session = await db.open_with_channel();
    await db.remove_lost_entries(session);
    session.close();
  } else if (alarm.name === 'remove-orphaned-entries') {
    const session = await db.open_with_channel();
    await db.remove_orphaned_entries(session);
    session.close();
  } else if (alarm.name === 'remove-untyped-objects') {
    const session = await db.open_with_channel();
    await db.remove_untyped_objects(session);
    session.close();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [await db.open_with_channel(), favicon.open()];
    const [session, iconn] = await Promise.all(proms);
    await refresh_feed_icons(session, iconn);
    session.close();
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

// TODO: switch to cross platform idle state query, see
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/idle/queryState

function query_idle_state(idle_secs) {
  return new Promise(res => chrome.idle.queryState(idle_secs, res));
}

// TODO: should this check for configuration changes and delete-create changed
// alarms? or just overwrite everytime?
export function update_alarms(prev_version_string) {
  for (const alarm of alarms) {
    if (alarm.deprecated) {
      chrome.alarms.clear(
          alarm.name, cleared => on_remove_alarm.bind(null, alarm.name));
    }
  }
}

export function create_alarms() {
  for (const alarm of alarms) {
    if (!alarm.deprecated) {
      chrome.alarms.create(alarm.name, {periodInMinutes: alarm.period});
    }
  }
}

function on_remove_alarm(alarm_name, was_cleared) {
  if (was_cleared) {
    console.log('Removed alarm', alarm_name);
  }
}
