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
  const pfc = new poll_feeds_context();
  pfc.allow_metered_connections = true;
  pfc.ignore_idle_state = true;
  pfc.ignore_recency_check = true;
  pfc.ignore_modified_check = true;

  try {
    [pfc.reader_conn, pfc.icon_conn] = await Promise.all([reader_db_open(),
      favicon_db_open()]);
    await poll_feeds(pfc);
  } catch(error) {
    console.warn(error);
  } finally {
    if(pfc.reader_conn) {
      pfc.reader_conn.close();
    }
    if(pfc.icon_conn) {
      pfc.icon_conn.close();
    }
  }
}
