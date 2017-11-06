'use strict';

// import rbl.js
// import reader-storage.js

async function test_archive_entries() {
  console.log('test_archive_entries start');

  const name = 'test-archive-entries';
  const version = 20;
  let closeRequested = false;
  let conn, timeoutMs = 1000, maxAgeMs;
  const limit = 5;
  try {
    conn = await rbl.openDB(name, version, readerDbOnUpgradeNeeded,
      timeoutMs);
    await readerStorageArchiveEntries(conn, maxAgeMs, limit);
    rbl.closeDB(conn);
    closeRequested = true;
    await rbl.deleteDB(conn.name);
  } finally {
    if(!closeRequested) {
      rbl.closeDB(conn);
    }
  }
}
