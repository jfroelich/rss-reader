
import assert from "/src/assert.js";
import {setBadgeText} from "/src/extension.js";
import {readerDbIsOpen, readerDbCountUnreadEntries} from "/src/rdb.js";

const DEBUG = true;

// @throws {AssertionError}
// @throws {Error} database related
export async function readerBadgeUpdate(conn) {
  assert(readerDbIsOpen(conn));

  const count = await readerDbCountUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  if(DEBUG) {
    console.debug('setting badge text to', text);
  }

  setBadgeText(text);
}
