// See license.md

// import rbl.js
// import reader-db.js

// TODO: test timeouts
// TODO: this is out of date. readerDbOpen does not accept params
// To test, use openDB

async function test() {
  const name = 'test-feed-db', version = 1;
  let close_requested = false;
  let conn;
  try {
    conn = await openDB(name, version, readerDbOnUpgradeNeeded);
    assert(isOpenDB(conn));
    closeDB(conn);

    if(isOpenDB(conn)) {
      console.debug('NOT DESIRED: isOpenDB says open after conn closed');
    } else {
      console.debug('DESIRED: isOpenDB says conn closed');
    }

    close_requested = true;
    await deleteDB(name);
  } finally {
    if(!close_requested) {
      closeDB(conn);
      assert(!isOpenDB(conn));
    }
  }
}
