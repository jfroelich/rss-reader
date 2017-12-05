import assert from "/src/assert/assert.js";
import {setBadgeText} from "/src/platform/platform.js";
import countUnreadEntriesInDb from "/src/reader-db/count-unread-entries.js";
import {isOpen} from "/src/indexeddb/utils.js";

const DEBUG = true;

export default async function updateBadgeText(conn) {
  assert(isOpen(conn));

  const count = await countUnreadEntriesInDb(conn);
  const text = count > 999 ? '1k+' : '' + count;

  if(DEBUG) {
    console.debug('setting badge text to', text);
  }

  setBadgeText(text);
}
