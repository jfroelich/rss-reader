// See license.md

// TODO: this isn't a reader-db.js test, this is an idb.js test, rename files


import assert from "/src/assert.js";
import {openDB, isOpenDB, closeDB, deleteDB} from "/src/idb.js";

// TODO: i don't think this is exported
import {readerDbOnUpgradeNeeded} from "/src/reader-db.js";

async function test() {
  const name = 'test-feed-db', version = 1;
  let closeRequested = false;
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

    closeRequested = true;
    await deleteDB(name);
  } finally {
    if(!closeRequested) {
      closeDB(conn);
      assert(!isOpenDB(conn));
    }
  }
}
