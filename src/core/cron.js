import * as cdb from '/src/core/cdb.js';
import * as favicon from '/src/core/favicon.js';
import * as ops from '/src/core/ops.js';
import {PollOperation} from '/src/core/poll-feeds.js';
import * as idle from '/src/lib/idle.js';
import * as tls from '/src/lib/tls.js';

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
  for (const desc of alarms) {
    chrome.alarms.create(desc.name, {periodInMinutes: desc.period});
  }
}

export function update_alarms(prev_version_string) {
  for (const name of deprecated_alarms) {
    chrome.alarms.clear(name, cleared => {
      if (cleared) {
        console.log('Removed alarm', name);
      }
    });
  }
}

export async function alarm_listener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  tls.write_string('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const session = new cdb.CDB();
    await session.open();
    await session.archiveEntries();
    session.close();
  } else if (alarm.name === 'poll') {
    await handle_alarm_poll();
  } else if (alarm.name === 'refresh-feed-icons') {
    const session = new cdb.CDB();
    const proms = [session.open(), favicon.open()];
    const [_, iconn] = await Promise.all(proms);
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
  if (tls.read_boolean('only_poll_if_idle')) {
    const idle_states = ['locked', 'idle'];
    const idle_secs = 30;
    const idle_state = await idle.query_state(idle_secs);
    if (!idle_states.includes(idle_state)) {
      console.debug('Canceling poll-feeds alarm as not idle');
      return;
    }
  }

  const session = new cdb.CDB();
  const promises = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(promises);

  const poll = new PollOperation();
  poll.session = session;
  poll.iconn = iconn;
  poll.ignore_recency_check = false;
  poll.notify = true;
  await poll.run();
  session.close();
  iconn.close();
}
