'use strict';

// import base/indexeddb.js
// import base/number.js
// import base/errors.js
// import poll/poll.js
// import favicon.js
// import reader-db.js
// import reader-storage.js

async function cli_refresh_feed_icons() {
  let reader_conn, icon_conn, status;
  try {
    [reader_conn, icon_conn] = await Promise.all([reader_db_open(),
      favicon_db_open()]);
    status = await reader_storage_refresh_feed_icons(reader_conn, icon_conn);
  } finally {
    indexeddb_close(reader_conn, icon_conn);
  }

  return status;
}

async function cli_archive_entries(limit) {
  console.log('cli_archive_entries start');
  let max_age_ms, conn, status;
  limit = limit || 10;
  try {
    conn = await reader_db_open();
    status = await reader_storage_archive_entries(conn, max_age_ms, limit);
  } finally {
    indexeddb_close(conn);
  }
  console.log('cli_archive_entries end');
  return status;
}

async function cli_poll_feeds() {
  console.log('cli_poll_feeds start');
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
    indexeddb_close(pfc.reader_conn, pfc.icon_conn);
  }

  // TODO: once poll_feeds returns status, use that as return value
  console.log('cli_poll_feeds end');
  return RDR_OK;
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
    indexeddb_close(conn);
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
    indexeddb_close(conn);
  }

  return status;
}

async function cli_clear_favicons() {
  console.log('cli_clear_favicons start');
  let conn;
  try {
    conn = await favicon_db_open();
    await favicon_db_clear(conn);
  } finally {
    indexeddb_close(conn);
  }

  return RDR_OK;
}
