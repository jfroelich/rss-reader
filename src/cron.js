import * as config from '/src/config.js';
import * as favicon from '/src/favicon/favicon-control.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {refresh_feed_icons} from '/src/refresh-feed-icons.js';
import * as db from '/src/db/db.js';

const HALF_DAY_MINUTES = 60 * 12;
const ONE_WEEK_MINUTES = 60 * 24 * 7;

const alarms = [
  {name: 'archive', period: HALF_DAY_MINUTES},
  {name: 'remove-entries-missing-urls', period: ONE_WEEK_MINUTES},
  {name: 'poll', period: ONE_WEEK_MINUTES},
  {name: 'remove-orphaned-entries', period: ONE_WEEK_MINUTES},
  {name: 'remove-untyped-objects', period: ONE_WEEK_MINUTES},
  {name: 'refresh-feed-icons', period: ONE_WEEK_MINUTES * 2},
  {name: 'compact-favicon-db', period: ONE_WEEK_MINUTES},
  {name: 'test-install-binding-alarms', deprecated: true},
  {name: 'db-remove-orphaned-entries', deprecated: true},
  {name: 'cleanup-refresh-badge-lock', deprecated: true}
];

export function install_listener(event) {
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
// TODO: shouldn't calls to remove an alarm only happen based on certain upgrades
// instead of blinding removing everything on every update?
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
