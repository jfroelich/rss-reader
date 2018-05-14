import {ENTRY_STATE_UNREAD} from '/src/db/entry.js';
import {console_stub} from '/src/lib/console-stub.js';

let update_pending = false;

export async function refresh_badge(conn, console = console_stub) {
  if (update_pending) {
    console.debug('%s: update pending', refresh_badge.name);
    return;
  }

  console.debug('%s: updating badge...', refresh_badge.name);
  update_pending = true;
  const count = await count_unread_entries(conn);
  console.debug('%s: counted %d unread entries', refresh_badge.name, count);
  const text = count > 999 ? '1k+' : '' + count;
  console.debug('%s: setting badge text to %s', refresh_badge.name, text);
  chrome.browserAction.setBadgeText({text: text});
  update_pending = false;
}

function count_unread_entries(conn) {
  return new Promise(count_executor.bind(null, conn));
}

function count_executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
