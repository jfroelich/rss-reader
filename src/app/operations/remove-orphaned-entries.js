import * as rdb from '/src/app/handles/rdb.js';
import {feed_is_valid_id} from '/src/app/objects/feed.js';

export async function remove_orphans(conn, channel) {
  const dconn = conn ? conn : await rdb.open();
  const entry_ids = await entry_store_remove_orphans_promise(dconn);
  if (!conn) {
    dconn.close();
  }

  if (channel && entry_ids.length) {
    const message = {type: 'entry-deleted', id: null, reason: 'orphan'};
    for (const id of entry_ids) {
      message.id = id;
      channel.postMessage(message);
    }
  }
}

function entry_store_remove_orphans_promise(conn) {
  return new Promise((resolve, reject) => {
    const entry_ids = [];
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve(entry_ids);
    tx.onerror = () => reject(tx.error);

    const feed_store = tx.objectStore('feed');
    const request_get_feed_ids = feed_store.getAllKeys();
    request_get_feed_ids.onsuccess = () => {
      const feed_ids = request_get_feed_ids.result;

      const entry_store = tx.objectStore('entry');
      const entry_store_cursor_request = entry_store.openCursor();
      entry_store_cursor_request.onsuccess = () => {
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
  });
}
