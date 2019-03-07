import * as favicon from '/src/lib/favicon.js';
import * as platform from '/src/lib/platform.js';
import * as tls from '/src/lib/tls.js';
import {Model} from '/src/model/model.js';
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

export function create_alarms() {
  for (const alarm of alarms) {
    platform.alarm.create(alarm.name, {periodInMinutes: alarm.period});
  }
}

export function update_alarms(prev_version_string) {
  const promises = [];
  for (const name of deprecated_alarms) {
    promises.push(platform.alarm.remove(name));
  }
  return Promise.all(promises);
}

export async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  tls.write_string('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const session = new Model();
    await session.open();
    await session.archiveEntries();
    session.close();
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
  const idle_poll_secs = tls.read_int('idle_poll_secs');
  if (Number.isInteger(idle_poll_secs) && idle_poll_secs > 0 &&
      tls.read_boolean('only_poll_if_idle')) {
    const idle_states = ['locked', 'idle'];
    const idle_state = await platform.idle.query(idle_poll_secs);
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
