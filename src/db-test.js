// See license.md

async function test() {
  console.log('Starting test');

  const db = new ReaderDb('test-feed-db', 1);
  console.log('Connecting to database', db.name);
  let conn;
  try {
    conn = await db.jrDbConnect();
    console.log('Connected to', db.name);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }

  console.log('Deleting database', db.name);
  try {
    await deleteDatabase(db.name);
    console.log('Deleted database', db.name);
  } catch(error) {
    console.warn(error);
  }

  console.log('Test completed');
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
