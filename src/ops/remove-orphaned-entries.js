// TODO: move to entry-store.js

import {is_valid_feed_id} from '/src/objects/feed.js';

export function remove_orphaned_entries() {
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
          this.console.debug(
              '%s: deleting entry', remove_orphaned_entries.name, entry.id);
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
