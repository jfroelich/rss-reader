import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import * as Status from "/src/common/status.js";

async function test() {
  const name = 'indexeddb-utils-test', version = 1;
  let conn, status, timeout, onUpgradeNeeded;

  [status, conn] = await IndexedDbUtils.open(name, version, onUpgradeNeeded, timeout);
  if(status !== Status.OK) {
    console.error('Failed to open database ' + conn.name);
    return;
  }

  if(!IndexedDbUtils.isOpen(conn)) {
    console.error('Opened database, but isOpen says not open');
    return;
  }

  IndexedDbUtils.close(conn);

  if(IndexedDbUtils.isOpen(conn)) {
    console.error('isOpen says open after conn closed');
  }

  try {
    await IndexedDbUtils.remove(name);
  } catch(error) {
    console.error(error);
  }

  console.debug('Test completed');
}

window.test = test;
