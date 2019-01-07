import * as config from '/src/config.js';
import * as favicon from '/src/favicon/favicon-control.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {refresh_feed_icons} from '/src/ops.js';
import * as cdb from '/src/cdb.js';

const HALF_DAY_MINUTES = 60 * 12;
const ONE_WEEK_MINUTES = 60 * 24 * 7;
const ONE_HOUR_MINUTES = 60;
const FORTNIGHT_MINUTES = ONE_WEEK_MINUTES * 2;

const alarms = [
  {name: 'archive', period: HALF_DAY_MINUTES},
  {name: 'remove-entries-missing-urls', deprecated: true},
  {name: 'poll', period: ONE_HOUR_MINUTES},
  {name: 'remove-orphaned-entries', deprecated: true},
  {name: 'remove-untyped-objects', deprecated: true},
  {name: 'refresh-feed-icons', period: FORTNIGHT_MINUTES},
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

  if (alarm.name === 'archive') {
    let max_age;
    const session = await cdb.open_with_channel();
    await cdb.archive_entries(session, max_age);
    session.close();
  } else if (alarm.name === 'poll') {
    await handle_alarm_poll();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [await cdb.open_with_channel(), favicon.open()];
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

async function handle_alarm_poll() {
  if (config.read_boolean('only_poll_if_idle')) {
    const idle_states = ['locked', 'idle'];
    const idle_secs = 30;
    const idle_state = await query_idle_state(idle_secs);
    if(!idle_states.includes(idle_state)) {
      console.debug('Canceling poll_feeds alarm as not idle');
      return;
    }
  }

  const promises = [cdb.open_with_channel(), favicon.open()];
  const [session, iconn] = await Promise.all(promises);
  const poll_options = {ignore_recency_check: false, notify: true};
  await poll_feeds(session, iconn, poll_options);
  session.close();
  iconn.close();
}

function query_idle_state(idle_secs) {
  return new Promise((resolve, reject) => {
    if(typeof chrome === 'object' && typeof chrome.idle === 'object' &&
      typeof chrome.idle.queryState === 'function') {
      chrome.idle.queryState(idle_secs, resolve);
    } else {
      reject(new Error('chrome.idle unavailable'));
    }
  });
}

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
