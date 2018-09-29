import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';

export async function delete_feed(conn, channel, feed_id, reason) {
  assert(feed_utils.is_valid_feed_id(feed_id));
  const entry_ids = await delete_feed_internal(conn, feed_id);

  if (channel) {
    channel.postMessage({type: 'feed-deleted', id: feed_id, reason: reason});
    for (const id of entry_ids) {
      channel.postMessage(
          {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
    }
  }
}

function delete_feed_internal(conn, feed_id) {
  return new Promise(delete_feed_executor.bind(null, conn, feed_id));
}

function delete_feed_executor(conn, feed_id, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(entry_ids);

  const feed_store = txn.objectStore('feed');
  feed_store.delete(feed_id);

  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = _ => {
    const keys = request.result;
    for (const id of keys) {
      entry_ids.push(id);
      entry_store.delete(id);
    }
  };
}
