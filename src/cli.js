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
      favicon_db_open()]);
    status = await refresh_feed_icons(reader_conn, icon_conn);
  } finally {
    if(reader_conn) {
      reader_conn.close();
    }

    if(icon_conn) {
      icon_conn.close();
    }
  }

  return status;
}


async function cli_archive_entries() {
  let max_age_ms, conn, status;
  try {
    conn = await reader_db_open();
    status = await archive_entries(conn, max_age_ms);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(status !== STATUS_OK) {
    console.log('archive_entries failed with status', status);
  }
}

async function cli_poll_feeds() {
  const pfd = new PollFeedsDescriptor();
  pfd.allow_metered_connections = true;
  pfd.ignore_idle_state = true;
  pfd.ignore_recency_check = true;
  pfd.ignore_modified_check = true;

  try {
    [pfd.reader_conn, pfd.icon_conn] = await Promise.all([reader_db_open(),
      favicon_db_open()]);
    await poll_feeds(pfd);
  } catch(error) {
    console.warn(error);
  } finally {
    if(pfd.reader_conn) {
      pfd.reader_conn.close();
    }
    if(pfd.icon_conn) {
      pfd.icon_conn.close();
    }
  }
}
