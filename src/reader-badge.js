
import {assert} from "/src/assert.js";
import {setBadgeText} from "/src/extension.js";
import {isOpenDB} from "/src/idb.js";
import {readerDbCountUnreadEntries} from "/src/reader-db.js";

const DEBUG = true;

// @throws {AssertionError}
// @throws {Error} database related
export async function readerBadgeUpdate(conn) {
  assert(isOpenDB(conn));

  const count = await readerDbCountUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  if(DEBUG) {
    console.debug('setting badge text to', text);
  }

  setBadgeText(text);
}
