import Connection from '/src/db/connection.js';
import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import assert from '/src/lib/assert.js';

export default function delete_feed(conn, feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(identifiable.is_valid_id(feed_id));

    const entry_ids = [];

    const txn = conn.conn.transaction(['feeds', 'entries'], 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => {
      if (conn.channel) {
        conn.channel.postMessage(
            {type: 'feed-deleted', id: feed_id, reason: reason});
        for (const id of entry_ids) {
          conn.channel.postMessage({
            type: 'entry-deleted',
            id: id,
            reason: reason,
            feed_id: feed_id
          });
        }
      }

      resolve(entry_ids);
    };

    const feed_store = txn.objectStore('feeds');
    feed_store.delete(feed_id);

    const entry_store = txn.objectStore('entries');
    const feed_index = entry_store.index('feed');
    // Avoid loading full entry data
    const request = feed_index.getAllKeys(feed_id);
    request.onsucess = function(event) {
      const keys = event.target.result;
      for (const id of keys) {
        entry_ids.push(id);
        entry_store.delete(id);
      }
    };
  });
}
