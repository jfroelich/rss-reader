import * as config from '/src/config/config.js';
import * as favicon from '/src/favicon/favicon.js';
import {Model} from '/src/model/model.js';
import archive_entries from '/src/model/ops/archive-entries.js';
import {poll_feeds, PollFeedsArgs} from '/src/ops/poll-feeds.js';
import {refresh_feed_icons} from '/src/ops/refresh-feed-icons.js';

const HALF_DAY_MINUTES = 60 * 12;
const ONE_WEEK_MINUTES = 60 * 24 * 7;
const ONE_HOUR_MINUTES = 60;
const FORTNIGHT_MINUTES = ONE_WEEK_MINUTES * 2;

const deprecated_alarms = [
  'remove-entries-missing-urls', 'remove-untyped-objects',
  'remove-orphaned-entries', 'test-install-binding-alarms',
  'db-remove-orphaned-entries', 'cleanup-refresh-badge-lock'
];

const alarms = [
  {name: 'archive', period: HALF_DAY_MINUTES},
  {name: 'poll', period: ONE_HOUR_MINUTES},
  {name: 'refresh-feed-icons', period: FORTNIGHT_MINUTES},
  {name: 'compact-favicon-db', period: ONE_WEEK_MINUTES}
];

export function query_idle_state(seconds) {
  return new Promise(resolve => chrome.idle.queryState(seconds, resolve));
}

export function create_alarms() {
  for (const alarm of alarms) {
    create_alarm(alarm.name, {periodInMinutes: alarm.period});
  }
}

export function create_alarm(name, options) {
  return chrome.alarms.create(name, options);
}

export function remove_alarm(name, callback) {
  return new Promise(resolve => {
    chrome.alarms.clear(name, function(cleared) {
      resolve({name: name, cleared: cleared});
    });
  });
}

export function update_alarms(prev_version_string) {
  const promises = [];
  for (const name of deprecated_alarms) {
    promises.push(remove_alarm(name));
  }
  return Promise.all(promises);
}

export async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  config.write_string('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const model = new Model();
    await model.open();
    await archive_entries(model);
    model.close();
  } else if (alarm.name === 'poll') {
    await handle_alarm_poll();
  } else if (alarm.name === 'refresh-feed-icons') {
    const session = new Model();
    const proms = [session.open(), favicon.open()];
    const [_, iconn] = await Promise.all(proms);
    await refresh_feed_icons(session, iconn);
    session.close();
    iconn.close();
  } else if (alarm.name === 'compact-favicon-db') {
    const conn = await favicon.open();
    await favicon.compact(conn);
    conn.close();
  } else {
    console.warn('Unhandled alarm', alarm.name);
  }
}



async function handle_alarm_poll() {
  const idle_poll_secs = config.read_int('idle_poll_secs');
  if (Number.isInteger(idle_poll_secs) && idle_poll_secs > 0 &&
      config.read_boolean('only_poll_if_idle')) {
    const idle_states = ['locked', 'idle'];
    const idle_state = await query_idle_state(idle_poll_secs);
    if (!idle_states.includes(idle_state)) {
      console.debug(
          'Canceling poll-feeds alarm as not idle for %d seconds',
          idle_poll_secs);
      return;
    }
  }

  const session = new Model();
  const promises = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(promises);

  const poll_args = new PollFeedsArgs();
  poll_args.model = session;
  poll_args.iconn = iconn;
  poll_args.ignore_recency_check = false;
  poll_args.notify = true;
  await poll_feeds(poll_args);
  session.close();
  iconn.close();
}
