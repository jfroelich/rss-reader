import assert from "/src/assert.js";
import * as idb from "/src/utils/idb.js";

function fakeOnUpgradeNeeded() {}

window.test = async function() {
  const name = 'test', version = 1;
  let closeRequested = false;
  let conn;
  try {
    // TODO: use timeout parameter
    conn = await idb.open(name, version, fakeOnUpgradeNeeded);
    assert(idb.isOpen(conn));
    idb.close(conn);

    if(idb.isOpen(conn)) {
      console.debug('NOT DESIRED: idb.isOpen says open after conn closed');
    } else {
      console.debug('DESIRED: idb.isOpen says conn closed');
    }

    closeRequested = true;
    await idb.remove(name);
  } finally {
    if(!closeRequested) {
      idb.close(conn);
      assert(!idb.isOpen(conn));
    }
  }
}
