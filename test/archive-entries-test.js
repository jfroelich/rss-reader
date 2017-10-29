'use strict';

// import base/indexeddb.js
// import reader-storage.js

async function test_archive_entries() {
  console.log('test_archive_entries start');

  const test_db_name = 'test-archive-entries';
  const test_db_version = 20;
  let was_conn_close_requested = false;
  let conn, conn_timeout_ms = 1000, entry_max_age_ms;

  try {
    conn = await indexeddb_open(test_db_name, test_db_version,
      reader_db_onupgradeneeded, conn_timeout_ms);
    const status = await reader_storage_archive_entries(entry_max_age_ms);
    indexeddb_close(conn);
    was_conn_close_requested = true;
    await indexeddb_delete_database(conn.name);
  } finally {
    if(!was_conn_close_requested) {
      indexeddb_close(conn);
    }
  }
}
