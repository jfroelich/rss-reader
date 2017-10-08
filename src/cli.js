'use strict';

const cli = {};

// Archive entries from the console
cli.archive_entries = async function() {
  let max_age_ms;
  let conn;
  let status;
  try {
    conn = await reader_db_open();
    status = await archive_entries(conn, max_age_ms);
  } finally {
    if(conn)
      conn.close();
  }

  if(status !== STATUS_OK) {
    DEBUG('archive_entries failed with status', status);
  }
};

// Check for updated console from the console
cli.poll_feeds = async function() {
  const flags = POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS |
    POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE |
    POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK |
    POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK;

  let recency_period_ms, idle_period_secs, fetch_feed_timeout_ms,
    fetch_html_timeout_ms, fetch_img_timeout_ms;
  await poll_feeds(idle_period_secs, recency_period_ms,
    fetch_feed_timeout_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    flags);
};
