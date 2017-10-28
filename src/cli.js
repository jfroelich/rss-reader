'use strict';

// import base/number.js
// import base/status.js
// import poll/poll.js
// import favicon.js
// import reader-db.js

async function cli_refresh_feed_icons() {
  let reader_conn, icon_conn, status;

  try {
    [reader_conn, icon_conn] = await Promise.all([reader_db_open(),
      favicon_db_open()]);
    status = await reader_storage_refresh_feed_icons(reader_conn, icon_conn);
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
    status = await reader_storage_archive_entries(conn, max_age_ms);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  return status;
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
  } finally {
    if(pfc.reader_conn) {
      pfc.reader_conn.close();
    }
    if(pfc.icon_conn) {
      pfc.icon_conn.close();
    }
  }

  // TODO: once poll_feeds returns status, use that as return value

  return STATUS_OK;
}

async function cli_scan_lost(limit) {
  console.log('cli_scan_lost start');
  if(!number_is_positive_integer(limit) || limit < 1) {
    throw new TypeError('limit must be > 0');
  }

  let conn, status;
  try {
    conn = await reader_db_open();
    status = await reader_storage_remove_lost_entries(conn, limit);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  return status;
}

async function cli_scan_orphan(limit) {

  console.log('cli_scan_orphan start');
  if(!number_is_positive_integer(limit) || limit < 1) {
    throw new TypeError('limit must be > 0');
  }

  let conn, status;
  try {
    conn = await reader_db_open();
    status = await reader_storage_remove_orphans(conn, limit);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  return status;
}
