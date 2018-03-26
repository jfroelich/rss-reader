import {feed_is_valid_id} from '/src/objects/feed.js';

export function delete_feed(conn, channel, feed_id, reason_text) {
  assert(feed_is_valid_id(feed_id));

  return new Promise(executor.bind(null, conn, channel, feed_id, reason_text));
}

function executor(conn, channel, feed_id, reason_text, resolve, reject) {
  let entry_ids;
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(
      txn, channel, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  console.debug('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Find and delete all entries belonging to the feed
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = function(event) {
    entry_ids = request.result;
    for (const id of entry_ids) {
      console.debug('Deleting entry', id);
      entry_store.delete(id);
    }
  };
}

function txn_oncomplete(
    channel, feed_id, reason_text, entry_ids, callback, event) {
  if (channel) {
    channel.postMessage(
        {type: 'feed-deleted', id: feed_id, reason: reason_text});
    for (const id of entry_ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: reason_text});
    }
  }

  callback(entry_ids);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
