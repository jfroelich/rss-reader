// See license.md

'use strict';

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
async function test() {
  const max_age = 10;
  let close_called = false;
  const db = new FeedDb();
  db.name = 'test-archive-entries';
  db.version = 1;
  db.log = console;

  try {
    await db.connect();    
    const num_modified = await archive_entries(db, max_age, console);
    db.close();
    close_called = true;
    await FeedDb.removeDatabase(target.name);
  } catch(error) {
    console.debug(error);
  } finally {
    if(!close_called && db)
      db.close();
  }
}
