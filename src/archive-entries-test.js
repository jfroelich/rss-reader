// See license.md
'use strict';

async function testArchiveEntries() {
  console.log('Running test testAchiveArchives');
  const testDbName = 'test-archive-entries';
  const testDbVersion = 1;
  let isClosed = false;
  let conn, connTimeout;

  try {
    conn = await openReaderDb(testDbName, testDbVersion, connTimeout);
    // TODO: what is undefined referring to? what is true referring to?
    const numEntriesModified = await archiveEntries(conn, undefined, true);
    console.log('Num entries modified:', numEntriesModified);
    conn.close();
    isClosed = true;
    await deleteDatabase(conn.name);
  } finally {
    if(conn && !isClosed) {
      conn.close();
    }
  }
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
