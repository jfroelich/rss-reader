import {assert} from '/src/assert/assert.js';
import * as Feed from '/src/data-layer/feed.js';

// Remove a feed and its entries, posts a message for each removal.
// If feed id does not exist then no error is thrown this is just a noop.
export function delete_feed(conn, post_message = noop, feed_id, reason) {
  return new Promise((resolve, reject) => {
    // If not checked this would be a noop which is misleading
    assert(Feed.is_valid_id(feed_id));

    const entry_ids = [];
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.oncomplete = _ => {
      let msg = {type: 'feed-deleted', id: feed_id, reason: reason};
      post_message(msg);
      msg = {type: 'entry-deleted', id: 0, reason: reason, feed_id: feed_id};
      for (const id of entry_ids) {
        msg.id = id;
        post_message(msg);
      }
      resolve();
    };

    txn.onerror = _ => reject(txn.error);

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
  });
}

function noop() {}
