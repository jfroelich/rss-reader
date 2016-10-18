// See license.md

function test() {
  const db = new FeedDb();
  db.name = 'test-feed-db';
  db.version = 1;
  db.log = console;
  db.connect(connect_on_success, connect_on_error);

  function connect_on_success(conn) {
    console.log('Successfully opened database', db.name);
    console.log('Requesting database %s to close eventually', db.name);
    conn.close();
    const request = db.delete();
    request.onsuccess = delete_on_success;
    request.onerror = delete_on_error;
  }

  function connect_on_error() {
    const request = db.delete();
    request.onsuccess = delete_on_success;
    request.onerror = delete_on_error;
  }

  function delete_on_success(event) {
    console.log('Deleted database', db.name);
  }

  function delete_on_error(event) {
    console.error(event.target.error);
  }
}

window.addEventListener('DOMContentLoaded', test);
