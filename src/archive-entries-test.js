// See license.md

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database

function test() {
  // Create a fake database so we can freely test
  const db = new FeedDb();
  db.name = 'test-archive-entries';
  db.version = 1;
  db.log = console;

  // TODO: i need to insert test entries, then run the archive,
  // then test assertions

  const age = 10;// test using 10ms
  const verbose = true;
  archiveEntries(db, age, verbose, onArchive);

  function onArchive() {
    db.delete();
  }
}
