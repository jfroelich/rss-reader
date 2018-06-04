import {is_valid_feed_id} from '/src/feed.js';
import {log} from '/src/log.js';

// TODO: this potentially affects unread count and should be calling
// refresh_badge?
// TODO: test

// Scans the database for entries not linked to a feed and deletes them
// @param conn {IDBDatabase} open database connection
// @param channel {BroadcastChannel} optional, broadcast channel
export function db_remove_orphaned_entries() {
  return new Promise(executor.bind(this));
}

function executor(resolve, reject) {
  const entry_ids = [];
  const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  const request_get_feed_ids = feed_store.getAllKeys();
  request_get_feed_ids.onsuccess = _ => {
    const feed_ids = request_get_feed_ids.result;

    const entry_store = txn.objectStore('entry');
    const entry_store_cursor_request = entry_store.openCursor();
    entry_store_cursor_request.onsuccess = _ => {
      const cursor = entry_store_cursor_request.result;
      if (cursor) {
        const entry = cursor.value;
        if (!is_valid_feed_id(entry.feed) || !feed_ids.includes(entry.feed)) {
          entry_ids.push(entry.id);
          log('%s: deleting entry', db_remove_orphaned_entries.name, entry.id);
          cursor.delete();
        }

        cursor.continue();
      }
    };
  };
}

function txn_oncomplete(entry_ids, callback, event) {
  const message = {type: 'entry-deleted', id: 0, reason: 'orphan'};
  for (const id of entry_ids) {
    message.id = id;
    this.channel.postMessage(message);
  }

  callback(entry_ids);
}
