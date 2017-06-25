// See license.md

'use strict';

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
async function testArchiveEntries() {
  console.log('Running test testAchiveArchives');
  const testDbName = 'test-archive-entries';
  const testDbVersion = 1;
  let isClosed = false;
  let conn;

  try {
    conn = await db.connect(testDbName, testDbVersion);
    const numEntriesModified = await operations.archiveEntries(conn, undefined, console);
    console.log('Num entries modified:', numEntriesModified);
    conn.close();
    isClosed = true;
    await db.deleteDatabase(conn.name);
  } catch(error) {
    console.error(error);
  } finally {
    if(conn && !isClosed) {
      conn.close();
    }
  }
}
