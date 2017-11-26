import archiveEntries from "/src/jobs/archive-entries/archive-entries.js";
import * as rdb from "/src/storage/rdb.js";
import {close as closeDb, remove as removeDb} from "/src/utils/idb.js";

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
    closeDb(conn);
    closeRequested = true;
    await removeDb(conn.name);
  } finally {
    if(!closeRequested) {
      closeDb(conn);
    }
  }
}
