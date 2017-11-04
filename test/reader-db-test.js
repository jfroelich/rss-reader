// See license.md

// import base/indexeddb.js
// import reader-db.js

// TODO: test timeouts
// TODO: this is out of date. readerDbOpen does not accept params
// To test, use indexedDBOpen

async function test() {
  const name = 'test-feed-db', version = 1;
  let close_requested = false;
  let conn;
  try {
    conn = await indexedDBOpen(name, version, readerDbOnUpgradeNeeded);
    assert(indexedDBIsOpen(conn));
    indexedDBClose(conn);

    if(indexedDBIsOpen(conn)) {
      console.debug('NOT DESIRED: indexedDBIsOpen says open after conn closed');
    } else {
      console.debug('DESIRED: indexedDBIsOpen says conn closed');
    }

    close_requested = true;
    await indexedDBDeleteDatabase(name);
  } finally {
    if(!close_requested) {
      indexedDBClose(conn);
      assert(!indexedDBIsOpen(conn));
    }
  }
}
