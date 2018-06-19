import * as db from '/src/db/db.js';
import ExtensionLock from '/src/extension-lock/extension-lock.js';

// Refreshes the unread count displayed in Chrome's toolbar
// @param lock_value {String} optional, for debugging who obtained an internal
// extension lock
export async function refresh_badge(lock_value) {
  const lock_name = 'refresh_badge_cross_page_lock';
  const lock = new ExtensionLock(lock_name, lock_value);
  if (!lock.isLocked()) {
    lock.acquire(/* unlock_deadline */ 5000);
    const conn = await db.open_db();
    const count = await db.count_unread_entries(conn);
    conn.close();
    const text = count > 999 ? '1k+' : '' + count;
    chrome.browserAction.setBadgeText({text: text});
    lock.release();
  }
}
