import {clear, compact, lookup, open} from '/src/favicon-service/favicon-service.js';

/*
TODO:
* actually run tests instead of command line
* test offline
* test a non-existent host
* test a known host with origin /favicon.ico
* test a known host with <link> favicon
* test a non-expired cached input url
* test a non-expired cached redirect url
* test a non-expired cached origin url
* same as above 3 but expired
* test against icon with byte size out of bounds
* test cacheless versus caching?
* test compact
*/

// clang has problems here for some reason
// clang-format off

// @param cached {Boolean} if true, use a database
window.test_lookup = async function(url, cached) {
  const test_db_name = 'test-favicon-cache';

  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await open(test_db_name);
  }

  const icon_url_string = await lookup(query);
  if (cached) {
    query.conn.close();

    await db_remove(query.conn.name);
  }

  return icon_url_string;
}

window.test_compact = compact;
window.test_clear = clear;
// clang-format on

// Remove an indexedDB database by name
// @param name {String}
function db_remove(name) {
  return new Promise((resolve, reject) => {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}
