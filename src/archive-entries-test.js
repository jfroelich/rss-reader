// See license.md

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database

function test() {
  const fakeDbTarget = {
    'name': 'test-archive-entries',
    'version': 1
  };

  // TODO: i need to insert test entries, then run the archive,
  // then test assertions
  const maxAge = 10;// test using 10ms
  archive_entries(fakeDbTarget, maxAge, console, on_archive_complete);

  function on_archive_complete() {
    const request = indexedDB.deleteDatabase(fakeDbTarget.name);
    request.onsuccess = function(event) {
      console.log('Deleted database', fakeDbTarget.name);
    };
  }
}
