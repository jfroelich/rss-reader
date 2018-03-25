import {feed_is_valid_id} from '/src/app/objects/feed.js';

export function remove_orphans(conn, channel) {
  return new Promise(executor.bind(null, conn, channel));
}

function executor(conn, channel, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, entry_ids, resolve);
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
        if (!feed_is_valid_id(entry.feed) || !feed_ids.includes(entry.feed)) {
          entry_ids.push(entry.id);
          console.debug('Deleting orphaned entry', entry.id);
          cursor.delete();
        }

        cursor.continue();
      }
    };
  };
}

function txn_oncomplete(channel, entry_ids, callback, event) {
  if (channel && entry_ids.length) {
    const message = {type: 'entry-deleted', id: null, reason: 'orphan'};
    for (const id of entry_ids) {
      message.id = id;
      channel.postMessage(message);
    }
  }

  callback(entry_ids);
}
