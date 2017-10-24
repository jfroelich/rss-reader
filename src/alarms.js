'use strict';

// import base/status.js
// import poll/poll.js
// import reader-db.js
// import archive-entries.js
// import favicon.js
// import remove-entries-missing-urls.js
// import remove-orphaned-entries.js

async function alarms_on_archive_alarm() {
  let conn, max_age_ms, status;
  try {
    conn = await reader_db_open();
    status = await archive_entries(conn, max_age_ms);
  } catch(error) {
    console.error(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(status !== STATUS_OK) {
    console.log('archive entries failed status', status);
  }
}

async function alarms_on_compact_favicons_alarm() {
  let max_age_ms, conn;
  try {
    conn = await favicon_open_db();
    await favicon_compact_db(conn, max_age_ms);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }
}

async function alarms_on_poll_feeds_alarm() {
  const flags = 0; // all off
  let idle_period_secs, recency_period_ms, fetch_feed_timeout_ms,
    fetch_html_timeout_ms, fetch_image_timeout_ms;
  const promise = poll_feeds(idle_period_secs, recency_period_ms,
    fetch_feed_timeout_ms, fetch_html_timeout_ms,
    fetch_image_timeout_ms, flags);
  promise.catch(console.warn);
}

async function alarms_on_remove_entries_missing_urls_alarm() {
  let conn;
  try {
    conn = await reader_db_open();
    await remove_entries_missing_urls(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function alarms_on_remove_orphaned_entries_alarm() {
  let conn;
  try {
    conn = await reader_db_open();
    await remove_orphaned_entries(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function alarms_on_refresh_feed_icons_alarm() {

  let reader_conn, icon_conn, status;

  try {
    [reader_conn, icon_conn] = await Promise.all([reader_db_open(),
      favicon_open_db()]);
    status = await refresh_feed_icons(reader_conn, icon_conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  if(status !== STATUS_OK) {
    console.warn('alarms_on_refresh_feed_icons_alarm invalid status', status);
  }
}

async function alarms_on_alarm_wakeup(alarm) {
  console.log('alarms_on_alarm_wakeup', alarm.name);

  switch(alarm.name) {
  case 'archive':
    alarms_on_archive_alarm();
    break;
  case 'poll':
    alarms_on_poll_feeds_alarm();
    break;
  case 'remove-entries-missing-urls':
    alarms_on_remove_entries_missing_urls_alarm();
    break;
  case 'remove-orphaned-entries':
    alarms_on_remove_orphaned_entries_alarm();
    break;
  case 'refresh-feed-icons':
    alarms_on_refresh_feed_icons_alarm();
    break;
  case 'compact-favicon-db':
    alarms_on_compact_favicons_alarm();
    break;
  default:
    console.assert(false, 'unhandled alarm', alarm.name);
    break;
  }
}

function alarms_register_all() {
  console.log('alarms_register_all');

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

chrome.alarms.onAlarm.addListener(alarms_on_alarm_wakeup);

alarms_register_all();
