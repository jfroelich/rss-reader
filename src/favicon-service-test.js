import {clear, compact, lookup, open} from '/src/favicon-service.js';

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

window.testLookup =
    async function(url, cached) {
  const testDbName = 'test-favicon-cache';

  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await open(testDbName);
  }

  const iconURL = await lookup(query);
  if (cached) {
    query.conn.close();

    await remove(query.conn.name);
  }

  return iconURL;
}

    window.testClear = clear;
window.testCompact = compact;

function remove(name) {
  return new Promise((resolve, reject) => {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}
