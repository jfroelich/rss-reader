// See license.md

function test() {
  const db = new FeedDb();
  db.name = 'test-feed-db';
  db.version = 1;
  db.log = console;
  db.open(openOnSuccess, openOnError);

  function openOnSuccess(event) {
    console.log('Successfully opened database', db.name);
    const conn = event.target.result;
    console.log('Requesting database %s to close eventually', db.name);
    conn.close();
    const request = db.delete();
    request.onsuccess = deleteOnSuccess;
    request.onerror = deleteOnError;
  }

  function openOnError(event) {
    console.error(event.target.error);
    const request = db.delete();
    request.onsuccess = deleteOnSuccess;
    request.onerror = deleteOnError;
  }

  function deleteOnSuccess(event) {
    console.log('Deleted database', db.name);
  }

  function deleteOnError(event) {
    console.error(event.target.error);
  }
}

window.addEventListener('DOMContentLoaded', test);
