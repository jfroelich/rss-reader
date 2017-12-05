import archiveEntries from "/src/jobs/archive-entries/archive-entries.js";
import openReaderDb from "/src/reader-db/open.js";
import {close as closeDb, remove as removeDb} from "/src/indexeddb/utils.js";

async function test() {
  console.log('test start');

  const name = 'test-archive-entries';
  const version = 20;
  let closeRequested = false;
  let conn, timeoutMs = 1000, maxAgeMs;
  const limit = 5;
  try {
    conn = await openReaderDb(name, version, undefined, timeoutMs);
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
