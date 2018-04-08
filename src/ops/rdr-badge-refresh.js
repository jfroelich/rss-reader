import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {ENTRY_STATE_UNREAD} from '/src/objects/entry.js';

// TODO: look more into making rdr_badge_update easily unawaitable, because I
// only need to guarantee the request is set while the connection is not
// close-pending, so that even if the caller does close while it is pending,
// there is no issue, because close implicitly waits for pendings to settle.

let update_pending = false;

export async function rdr_badge_refresh(conn, console = console_stub) {
  if (update_pending) {
    console.debug('Prior update pending, update request canceled');
    return;
  }

  console.debug('Updating badge text...');
  update_pending = true;

  const count = await count_unread_entries(conn);
  console.debug('Counted %d unread entries', count);

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);

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
