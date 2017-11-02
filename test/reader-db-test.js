// See license.md

// import base/indexeddb.js
// import base/errors.js
// import reader-db.js

// TODO: test timeouts
// TODO: this is out of date. readerDbOpen does not accept params
// To test, use indexedDBOpen

async function test() {
  console.log('test_db start');

  const name = 'test-feed-db', version = 1;
  let close_requested = false;
  let conn;
  try {
    conn = await indexedDBOpen(name, version, readerDbOnUpgradeNeeded);
    console.assert(indexedDBIsOpen(conn));
    indexedDBClose(conn);

    if(indexedDBIsOpen(conn)) {
      console.debug('NOT DESIRED: indexedDBIsOpen says open after conn closed');
    } else {
      console.debug('DESIRED: indexedDBIsOpen says conn closed');
    }

    close_requested = true;
    await indexedDBDeleteDatabase(name);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  } finally {
    if(!close_requested) {
      indexedDBClose(conn);
      console.assert(!indexedDBIsOpen(conn));
    }
  }

  console.log('test_db end');
  return RDR_OK;
}
