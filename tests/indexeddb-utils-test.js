import assert from "/src/common/assert.js";
import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import * as Status from "/src/common/status.js";

function upgradeHandler() {}

window.test = async function() {
  const name = 'test', version = 1;
  let closeRequested = false;
  let conn, status;
  try {
    // TODO: use, or at least specify undefined, timeout parameter
    [status, conn] = await IndexedDbUtils.open(name, version, upgradeHandler);
    if(status !== Status.OK) {
      throw new Error('Failed to open database ' + name);
    }

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
