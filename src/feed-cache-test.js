// See license.md

function test() {

  const test_target = {
    'name': 'test-feed-db',
    'version': 1
  };

  const connectPromise = db_connect(test_target, console);
  connectPromise.then(connect_on_success);
  connectPromise.catch(connect_on_error);

  function connect_on_success(conn) {
    console.log('Successfully opened database', conn.name);
    console.log('Requesting database %s to close eventually', conn.name);
    conn.close();
    const request = indexedDB.deleteDatabase(conn.name);
    request.onsuccess = delete_on_success;
    request.onerror = delete_on_error;
  }

  function connect_on_error(error) {
    const request = indexedDB.deleteDatabase(test_target.name);
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
