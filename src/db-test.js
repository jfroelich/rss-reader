// See license.md

async function testDb() {
  console.log('Starting db test');

  const dbName = 'test-feed-db';
  const dbVersion = 1;
  console.log('Connecting to database', dbName);
  let conn;
  try {
    conn = await dbConnect(dbName, dbVersion);
    console.log('Connected to', dbName);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  console.log('Deleting database', dbName);
  try {
    await dbDeleteDatabase(dbName);
    console.log('Deleted database', dbName);
  } catch(error) {
    console.warn(error);
  }

  console.log('Db Test completed');
}
