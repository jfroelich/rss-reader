import * as config from '/src/lib/config.js';
import * as favicon from '/src/lib/favicon.js';
import * as rss from '/src/service/resource-storage-service.js';
import { PollFeedsArgs, pollFeeds } from '/src/service/poll-feeds.js';
import archiveResources from '/src/service/archive-resources.js';
import refreshFeedIcons from '/src/service/refresh-feed-icons.js';

// TODO: decide whether this should be a service or a control

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

export default function CronControl() { }

CronControl.prototype.init = function () {
  chrome.alarms.onAlarm.addListener(this.onAlarm.bind(this));
  chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
};

CronControl.prototype.onAlarm = async function (alarm) {
  console.debug('Alarm wokeup:', alarm.name);
  config.writeString('last_alarm', alarm.name);

  if (alarm.name === 'archive') {
    const conn = await rss.open();
    await archiveResources(conn);
    conn.close();
  } else if (alarm.name === 'poll') {
    await this.onPollAlarm();
  } else if (alarm.name === 'refresh-feed-icons') {
    const proms = [rss.open(), favicon.open()];
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
};

CronControl.prototype.onPollAlarm = async function () {
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

  const promises = [rss.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);
  const pollArgs = new PollFeedsArgs();
  pollArgs.conn = conn;
  pollArgs.iconn = iconn;
  pollArgs.ignoreRecencyCheck = false;
  pollArgs.notify = true;
  await pollFeeds(pollArgs);
  conn.close();
  iconn.close();
};

CronControl.prototype.onInstalled = async function (event) {
  if (event.reason === 'install') {
    this.createAlarms();
  } else {
    const promises = [];
    for (const name of deprecatedAlarmNames) {
      promises.push(removeAlarm(name));
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn(error);
    }
  }
};

CronControl.prototype.createAlarms = function () {
  for (const alarm of alarms) {
    chrome.alarms.create(alarm.name, { periodInMinutes: alarm.period });
  }
};

function queryIdleState(seconds) {
  return new Promise(resolve => chrome.idle.queryState(seconds, resolve));
}

function removeAlarm(name) {
  return new Promise((resolve) => {
    chrome.alarms.clear(name, (cleared) => {
      resolve({ name, cleared });
    });
  });
}
