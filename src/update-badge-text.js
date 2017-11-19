
import assert from "/src/utils/assert.js";
import * as platform from "/src/extension.js";
import * as rdb from "/src/rdb.js";

const DEBUG = true;

export default async function updateBadgeText(conn) {
  assert(rdb.isOpen(conn));
  const count = await rdb.countUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  if(DEBUG) {
    console.debug('setting badge text to', text);
  }

  platform.setBadgeText(text);
}
