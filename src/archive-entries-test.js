// See license.md

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
// TODO: i need to insert test entries, then run the archive,
// then test assertions

async function test() {
  const max_age = 10;
  try {
    const conn = await db_connect('test-archive-entries', 1, log);
    const num_modified = await archive_entries(conn, max_age, console);
    conn.close();
    await db_delete(target.name);
  } catch(error) {
    console.debug(error);
  }
}
