
// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database

// This is unfinished

// I think i need to bring in rdr.entry and all its dependencies in order to
// run this test, because I need to be able to easily add entries

function test() {

  const db = new FeedDbService();
  db.name = 'test-entry-archive-service';
  db.version = 1;
  db.verbose = true;

  const archiveService = new EntryArchiveService();

  // Mock sizeof, it is not being tested
  archiveService.sizeof = function() { return 0; };

  // TODO: actually use rdr.entry here probably, because I also need to
  // insert test data
  archiveService.entryFlags = {};

  // Show debug info in console
  archiveService.verbose = true;

  // Replace the default instance (the real data instance) with our test
  // instance. The test db will be implicitly created when the archive runs
  archiveService.dbService = db;

  // Prevent the test from having any affect on other windows
  archiveService.shouldSendMessage = false;

  // Delete the temp db once the archive finishes
  // TODO: i need to close connection before
  // - what connection though? I think I need two connections, one that
  // inserts test data, then the service creates and closes its own implicitly,
  // then we delete
  archiveService.callback = function() {
    db.delete();
  };

  // Create and insert some test data
  




  //archiveService.start();
}
