// See license.md

async function test() {
  const db_name = 'test-feed-db';
  let conn;
  try {
    conn = await db_connect(db_name, 1, console)
    console.log('Successfully opened database', conn.name);
    console.log('Requesting database %s to close eventually', conn.name);
  } catch(error) {
    console.log(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(conn) {
    try {
      console.log('Deleting database', conn.name);
      await db_delete(conn.name);
      console.log('Deleted database', conn.name);
    } catch(error) {
      console.log(error);
    }
  }
}
