// See license.md

async function testDb() {
  console.log('Starting db test');

  const dbName = 'test-feed-db';
  const dbVersion = 1;
  let connTimeoutMillis;
  let isClosed = false;

  let conn;
  try {
    console.log('Connecting to database', dbName);
    conn = await openReaderDb(dbName, dbVersion, connTimeoutMillis);
    console.log('Closing connection to', dbName);
    conn.close();
    isClosed = true;
    console.log('Deleting database', dbName);
    await deleteDatabase(dbName);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn && !isClosed) {
      conn.close();
    }
  }

  console.log('Db Test completed');
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
