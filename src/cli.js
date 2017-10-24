'use strict';

// import base/status.js
// import poll/poll.js
// import archive-entries.js
// import favicon.js
// import reader-db.js
// import refresh-feed-icons.js

async function cli_refresh_feed_icons() {

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

  return status;
}


async function cli_archive_entries() {
  let max_age_ms, conn, status;
  try {
    conn = await reader_db_open();
    status = await archive_entries(conn, max_age_ms);
  } finally {
    if(conn)
      conn.close();
  }

  if(status !== STATUS_OK) {
    console.log('archive_entries failed with status', status);
  }
}

async function cli_poll_feeds() {
  const flags = POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS |
    POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE |
    POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK |
    POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK;

  let recency_period_ms, idle_period_secs, fetch_feed_timeout_ms,
    fetch_html_timeout_ms, fetch_img_timeout_ms;
  await poll_feeds(idle_period_secs, recency_period_ms,
    fetch_feed_timeout_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    flags);
}
