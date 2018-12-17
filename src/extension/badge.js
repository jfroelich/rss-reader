import ExtensionLock from '/src/extension-utils/extension-lock.js';
import * as db from '/src/db/db.js';

export function install_listener(event) {
  console.debug('Install listener received event');
  // We do not care if event.reason is install or update. While it would seem
  // like we only need to do this on install, reloading the extension from
  // chrome's extensions page also triggers an update event where for some
  // reason the badge text is unset, so we must set it again.
  refresh(location.pathname);
}

export function startup_listener(event) {
  console.debug('Startup listener received event');
  refresh(location.pathname);
}

// Refreshes the unread count displayed the badge in Chrome's toolbar
// @param lock_value {String} optional, for debugging who obtained an internal
// extension lock
export async function refresh(lock_value) {
  const lock_name = 'refresh_badge_cross_page_lock';
  const lock = new ExtensionLock(lock_name, lock_value);
  if (!lock.isLocked()) {
    const unlock_deadline = 5000;
    lock.acquire(unlock_deadline);

    const session = await db.open();
    const count = await db.count_unread_entries(session);
    session.close();

    const text = count > 999 ? '1k+' : '' + count;
    chrome.browserAction.setBadgeText({text: text});

    lock.release();
  }
}
