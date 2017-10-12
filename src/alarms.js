'use strict';

/*
TODO: Gracefully manage background alarms. Create a graceful way to
rename/remove alarms. Right now if I stop using an alarm it remains silently
persistent somewhere in chrome.alarms internal state, indefinitely.

Maybe keep track of registered alarms in localStorage. This might also help
avoid repeated registration (although it still performs repeated checks
every page load)
*/

const ALARMS_DEBUG = false;

async function alarms_on_archive_alarm() {
  let conn;
  let db_name, db_version, db_conn_timeout;
  let max_age_ms;
  let status;
  try {
    conn = await reader_db_open(db_name, db_version, db_conn_timeout);
    status = await archive_entries(conn, max_age_ms);
  } catch(error) {
    if(ALARMS_DEBUG)
      DEBUG(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(status !== STATUS_OK) {
    if(ALARMS_DEBUG)
      DEBUG('archive entries failed status', status);
  }
}

async function alarms_on_alarm_wakeup(alarm) {
  if(ALARMS_DEBUG)
    DEBUG('alarm wokeup:', alarm.name);

  switch(alarm.name) {
  case 'archive':
    alarms_on_archive_alarm();
    break;
  case 'poll':
    const flags = 0; // all off
    let idle_period_secs, recency_period_ms, fetch_feed_timeout_ms,
      fetch_html_timeout_ms, fetch_image_timeout_ms;
    const promise = poll_feeds(idle_period_secs, recency_period_ms,
      fetch_feed_timeout_ms, fetch_html_timeout_ms,
      fetch_image_timeout_ms, flags);
    promise.catch(console.warn);
    break;
  case 'remove-entries-missing-urls':
    remove_entries_missing_urls().catch(console.warn);
    break;
  case 'remove-orphaned-entries':
    remove_orphaned_entries().catch(console.warn);
    break;
  case 'refresh-feed-icons':
    refresh_feed_icons().catch(console.warn);
    break;
  case 'compact-favicon-db':
    let name, version, max_age_ms;
    favicon_compact_db(name, version, max_age_ms).catch(console.warn);
    break;
  default:
    if(ALARMS_DEBUG)
      DEBUG('Unknown alarm:', alarm.name);
    break;
  }
}

function alarms_register_all() {
  // TODO: because this is currently called on script load, this may be before
  // other libs loaded. Therefore cannot use debug.js calls. That or I should
  // only call it after dom content loaded (that sounds better)
  if(ALARMS_DEBUG)
    console.debug('registering alarms');

  chrome.alarms.create('archive',
    {'periodInMinutes': 60 * 12});
  chrome.alarms.create('poll',
    {'periodInMinutes': 60});
  chrome.alarms.create('remove-entries-missing-urls',
    {'periodInMinutes': 60 * 24 * 7});
  chrome.alarms.create('remove-orphaned-entries',
    {'periodInMinutes': 60 * 24 * 7});
  chrome.alarms.create('refresh-feed-icons',
    {'periodInMinutes': 60 * 24 * 7 * 2});
  chrome.alarms.create('compact-favicon-db',
    {'periodInMinutes': 60 * 24 * 7});
}

// TODO: avoid doing this on every page load
chrome.alarms.onAlarm.addListener(alarms_on_alarm_wakeup);

// TODO: avoid doing this on every page load
alarms_register_all();
