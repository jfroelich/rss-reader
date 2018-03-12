import * as rdb from '/src/rdb/rdb.js';

// TODO: drop auto-connect support. The proper way, if at all, is to go through
// a layer similar to ral.js
// TODO: this potentially affects unread count and therefore should be
// interacting with badge_update_text
// TODO: add console parameter and NULL_CONSOLE impl
// TODO: trap postMessage errors in case channel closed when called unawaited?

// Scans the database for entries not linked to a feed and deletes them
// conn {IDBDatabase} is optional open database connection
// channel {BroadcastChannel} is optional broadcast channel
export default async function entry_store_remove_orphans(conn, channel) {
  const dconn = conn ? conn : await rdb.open();
  const entry_ids = await entry_store_remove_orphans_promise(dconn);
  if (!conn) {
    dconn.close();
  }

  // Now that the transaction committed, notify observers
  if (channel && entry_ids.length) {
    const message = {type: 'entry-deleted', id: null, reason: 'orphan'};
    for (const id of entry_ids) {
      message.id = id;
      channel.postMessage(message);
    }
  }
}

// Resolve to the array of deleted entry ids
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

      // Use a cursor rather than getAll for scalability
      const entry_store = tx.objectStore('entry');
      const entry_store_cursor_request = entry_store.openCursor();
      entry_store_cursor_request.onsuccess = () => {
        const cursor = entry_store_cursor_request.result;
        if (cursor) {
          const entry = cursor.value;
          if (!rdb.rdb_feed_is_valid_id(entry.feed) ||
              !feed_ids.includes(entry.feed)) {
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
