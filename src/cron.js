import * as favicon from '/lib/favicon.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import { pollFeeds, PollFeedsArgs } from '/src/poll-feeds.js';
import refreshFeedIcons from '/src/refresh-feed-icons.js';

const HALF_DAY_MINUTES = 60 * 12;
const ONE_WEEK_MINUTES = 60 * 24 * 7;
const ONE_HOUR_MINUTES = 60;
const FORTNIGHT_MINUTES = ONE_WEEK_MINUTES * 2;

const deprecatedAlarmNames = [
  'remove-entries-missing-urls', 'remove-untyped-objects',
  'remove-orphaned-entries', 'test-install-binding-alarms',
  'db-remove-orphaned-entries', 'cleanup-refresh-badge-lock'
];

const alarms = [
  { name: 'archive', period: HALF_DAY_MINUTES },
  { name: 'poll', period: ONE_HOUR_MINUTES },
  { name: 'refresh-feed-icons', period: FORTNIGHT_MINUTES },
  { name: 'compact-favicon-db', period: ONE_WEEK_MINUTES }
];

export function queryIdleState(seconds) {
  return new Promise(resolve => chrome.idle.queryState(seconds, resolve));
}

export function createAlarms() {
  for (const alarm of alarms) {
    createAlarm(alarm.name, { periodInMinutes: alarm.period });
  }
}

export function createAlarm(name, options) {
  return chrome.alarms.create(name, options);
}

export function removeAlarm(name) {
  return new Promise((resolve) => {
    chrome.alarms.clear(name, (cleared) => {
      resolve({ name, cleared });
    });
  });
}

export function updateAlarms() {
  const promises = [];
  for (const name of deprecatedAlarmNames) {
    promises.push(removeAlarm(name));
  }
  return Promise.all(promises);
}

export async function alarmListener(alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  config.writeString('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const conn = await db.open();
    await db.archiveResources(conn);
    conn.close();
  } else if (alarm.name === 'poll') {
    await handleAlarmPoll();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [db.open(), favicon.open()];
    const [conn, iconn] = await Promise.all(proms);
    await refreshFeedIcons(conn, iconn);
    conn.close();
    iconn.close();
  } else if (alarm.name === 'compact-favicon-db') {
    const conn = await favicon.open();
    await favicon.compact(conn);
    conn.close();
  } else {
    console.warn('Unhandled alarm', alarm.name);
  }
}

async function handleAlarmPoll() {
  const idlePollSeconds = config.readInt('idle_poll_secs');
  if (Number.isInteger(idlePollSeconds) && idlePollSeconds > 0 &&
      config.readBoolean('only_poll_if_idle')) {
    const idleStates = ['locked', 'idle'];
    const idleState = await queryIdleState(idlePollSeconds);
    if (!idleStates.includes(idleState)) {
      console.debug('Canceling poll-feeds alarm as not idle for %d seconds', idlePollSeconds);
      return;
    }
  }

  const promises = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);
  const pollArgs = new PollFeedsArgs();
  pollArgs.conn = conn;
  pollArgs.iconn = iconn;
  pollArgs.ignoreRecencyCheck = false;
  pollArgs.notify = true;
  await pollFeeds(pollArgs);
  conn.close();
  iconn.close();
}
