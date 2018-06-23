import {ReaderDAL} from '/src/dal.js';
import ExtensionLock from '/src/extension-lock.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
// @param lock_value {String} optional, for debugging who obtained an internal
// extension lock
export async function refresh(lock_value) {
  const lock_name = 'refresh_badge_cross_page_lock';
  const lock = new ExtensionLock(lock_name, lock_value);
  if (!lock.isLocked()) {
    lock.acquire(/* unlock_deadline */ 5000);

    const dal = new ReaderDAL();
    await dal.connect();
    const count = await dal.countUnreadEntries();
    dal.close();

    const text = count > 999 ? '1k+' : '' + count;
    chrome.browserAction.setBadgeText({text: text});

    lock.release();
  }
}
