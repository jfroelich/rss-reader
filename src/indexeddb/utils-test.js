import assert from "/src/assert/assert.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";

function fakeOnUpgradeNeeded() {}

window.test = async function() {
  const name = 'test', version = 1;
  let closeRequested = false;
  let conn;
  try {
    // TODO: use timeout
    conn = await IndexedDbUtils.open(name, version, fakeOnUpgradeNeeded);
    assert(IndexedDbUtils.isOpen(conn));
    IndexedDbUtils.close(conn);

    if(IndexedDbUtils.isOpen(conn)) {
      console.debug('NOT DESIRED: IndexedDbUtils.isOpen says open after conn closed');
    } else {
      console.debug('DESIRED: IndexedDbUtils.isOpen says conn closed');
    }

    closeRequested = true;
    await IndexedDbUtils.remove(name);
  } finally {
    if(!closeRequested) {
      IndexedDbUtils.close(conn);
      assert(!IndexedDbUtils.isOpen(conn));
    }
  }
}
