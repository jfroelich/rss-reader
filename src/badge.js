import {open_feed_db} from '/src/db/open-feed-db.js';
import {ENTRY_STATE_UNREAD} from '/src/entry.js';
import {log} from '/src/log.js';

let update_pending = false;

export async function refresh_badge(conn) {
  if (update_pending) {
    log('%s: update pending', refresh_badge.name);
    return;
  }

  log('%s: updating badge...', refresh_badge.name);
  update_pending = true;
  const count = await count_entries(conn, 'unread');
  log('%s: counted %d unread entries', refresh_badge.name, count);
  const text = count > 999 ? '1k+' : '' + count;
  log('%s: setting badge text to %s', refresh_badge.name, text);
  chrome.browserAction.setBadgeText({text: text});
  update_pending = false;
}

export async function init_badge() {
  const conn = await open_feed_db();
  refresh_badge(conn).catch(console.error);

  // We can enqueue the close immediately before refresh has completed, which
  // is why above line not awaited. close implicitly waits for pending
  // transactions to settle instead of aborting them.

  // Not using promise.finally() because there is no point to graceful
  // recovery

  conn.close();
}

export function register_badge_click_listener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}

function count_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
