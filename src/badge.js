import * as db from '/src/db.js';

// Refreshes the unread count displayed in Chrome's toolbar
//
// @param locker_name {String} optional, for debugging who obtained an internal
// cross-page lock
export async function refresh_badge(locker_name = 'unknown') {
  // Check if locked by looking for the lock and then cancel if locked. A key's
  // presence in storage is enough, do not care about its value.
  const existing_lock = localStorage.refresh_badge_cross_page_lock;
  if (typeof existing_lock !== 'undefined') {
    return;
  }

  // Obtain a lock
  localStorage.refresh_badge_cross_page_lock = locker_name;

  // Extra paranoid, schedule an unlock immediately
  let did_auto_unlock = false;
  const auto_unlock_timer = setTimeout(_ => {
    console.warn('Releasing lock abnormally, locker was %s', locker_name);
    did_auto_unlock = true;
    delete localStorage.refresh_badge_cross_page_lock;
  }, 5000);

  const conn = await db.open_db();
  const count = await db.count_unread_entries(conn);
  conn.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});

  // If did not auto-unlock then proceed with normal cleanup
  if (!did_auto_unlock) {
    // Cancel the auto-unlock given that we are on the normal path
    clearTimeout(auto_unlock_timer);
    // Unlock
    delete localStorage.refresh_badge_cross_page_lock;
  }
}
