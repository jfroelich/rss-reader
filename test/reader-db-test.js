// See license.md

// TODO: test timeouts
// TODO: this is out of date. readerDbOpen does not accept params
// To test, use openDB

import {assert} from "/src/assert.js";
import {openDB, isOpenDB, closeDB, deleteDB} from "/src/rbl.js";

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
