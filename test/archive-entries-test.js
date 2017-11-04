'use strict';

// import base/indexeddb.js
// import reader-storage.js

async function test_archive_entries() {
  console.log('test_archive_entries start');

  const name = 'test-archive-entries';
  const version = 20;
  let closeRequested = false;
  let conn, timeoutMs = 1000, maxAgeMs;
  const limit = 5;
  try {
    conn = await indexedDBOpen(name, version, readerDbOnUpgradeNeeded,
      timeoutMs);
    await readerStorageArchiveEntries(conn, maxAgeMs, limit);
    indexedDBClose(conn);
    closeRequested = true;
    await indexedDBDeleteDatabase(conn.name);
  } finally {
    if(!closeRequested) {
      indexedDBClose(conn);
    }
  }
}
