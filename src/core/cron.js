import * as cdb from '/src/core/cdb.js';
import * as favicon from '/src/core/favicon.js';
import * as ops from '/src/core/ops.js';
import {PollOperation} from '/src/core/poll-feeds.js';
import * as utils from '/src/core/utils.js';
import * as config from '/src/lib/config.js';

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

export async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  config.write_string('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    let max_age;
    const session = await cdb.open();
    await cdb.archive_entries(session, max_age);
    session.close();
  } else if (alarm.name === 'poll') {
    await handle_alarm_poll();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [await cdb.open(), favicon.open()];
    const [session, iconn] = await Promise.all(proms);
    await ops.refresh_feed_icons(session, iconn);
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
  if (config.read_boolean('only_poll_if_idle')) {
    const idle_states = ['locked', 'idle'];
    const idle_secs = 30;
    const idle_state = await utils.query_idle_state(idle_secs);
    if (!idle_states.includes(idle_state)) {
      console.debug('Canceling poll-feeds alarm as not idle');
      return;
    }
  }

  const promises = [cdb.open(), favicon.open()];
  const [session, iconn] = await Promise.all(promises);

  const poll = new PollOperation();
  poll.session = session;
  poll.iconn = iconn;
  poll.ignore_recency_check = false;
  poll.notify = true;
  await poll.run();
  session.close();
  iconn.close();
}

export function update_alarms(prev_version_string) {
  for (const name of deprecated_alarms) {
    chrome.alarms.clear(name, cleared => on_remove_alarm.bind(null, name));
  }
}

export function create_alarms() {
  for (const desc of alarms) {
    console.debug('Creating alarm', desc.name);
    chrome.alarms.create(desc.name, {periodInMinutes: desc.period});
  }
}

function on_remove_alarm(name, was_cleared) {
  if (was_cleared) {
    console.log('Removed alarm', name);
  }
}
