import * as db from '/src/db/db.js';
import ExtensionLock from '/src/extension-lock/extension-lock.js';
import * as Entry from '/src/model/entry.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
// @param lock_value {String} optional, for debugging who obtained an internal
// extension lock
export async function refresh(lock_value) {
  const lock_name = 'refresh_badge_cross_page_lock';
  const lock = new ExtensionLock(lock_name, lock_value);
  if (!lock.isLocked()) {
    lock.acquire(/* unlock_deadline */ 5000);
    const conn = await db.open_db();
    const count = await db_count_unread_entries(conn);
    conn.close();
    const text = count > 999 ? '1k+' : '' + count;
    chrome.browserAction.setBadgeText({text: text});
    lock.release();
  }
}

function db_count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
