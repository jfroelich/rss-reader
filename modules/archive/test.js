// See license.md

'use strict';

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
async function test() {
  const max_age = 10;
  try {
    const conn = await db_connect('test-archive-entries', 1, console);
    const num_modified = await archive_entries(conn, max_age, console);
    conn.close();
    await db_delete(target.name);
  } catch(error) {
    console.debug(error);
  }
}
