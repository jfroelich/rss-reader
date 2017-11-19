
import archiveEntries from "/src/archive-entries/archive-entries.js";
import {remove as deleteDB} from "/src/utils/idb.js";
import * as rdb from "/src/rdb.js";

async function test() {
  console.log('test start');

  const name = 'test-archive-entries';
  const version = 20;
  let closeRequested = false;
  let conn, timeoutMs = 1000, maxAgeMs;
  const limit = 5;
  try {
    conn = await rdb.open(name, version, rdb.onUpgradeNeeded, timeoutMs);
    await archiveEntries(conn, maxAgeMs, limit);
    rdb.close(conn);
    closeRequested = true;
    await deleteDB(conn.name);
  } finally {
    if(!closeRequested) {
      rdb.close(conn);
    }
  }
}
