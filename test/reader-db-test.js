// See license.md

// import rbl.js
// import reader-db.js

// TODO: test timeouts
// TODO: this is out of date. readerDbOpen does not accept params
// To test, use rbl.openDB

async function test() {
  const name = 'test-feed-db', version = 1;
  let close_requested = false;
  let conn;
  try {
    conn = await rbl.openDB(name, version, readerDbOnUpgradeNeeded);
    assert(rbl.isOpenDB(conn));
    rbl.closeDB(conn);

    if(rbl.isOpenDB(conn)) {
      console.debug('NOT DESIRED: rbl.isOpenDB says open after conn closed');
    } else {
      console.debug('DESIRED: rbl.isOpenDB says conn closed');
    }

    close_requested = true;
    await rbl.deleteDB(name);
  } finally {
    if(!close_requested) {
      rbl.closeDB(conn);
      assert(!rbl.isOpenDB(conn));
    }
  }
}
