// See license.md

'use strict';

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
async function test() {
  const max_age = 10;
  let closed = false;
  const db = new ReaderDb('test-archive-entries', 1);

  let conn;
  try {
    conn = await db.connect();
    const num_modified = await archive_entries(conn, max_age, console);
    conn.close();
    closed = true;
    await deleteDatabase(conn.name);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn && !closed)
      conn.close();
  }
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
