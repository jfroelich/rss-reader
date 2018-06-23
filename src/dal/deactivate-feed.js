import {assert} from '/src/assert/assert.js';
import * as Feed from '/src/data-layer/feed.js';

export function deactivate_feed(conn, channel, feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-deactivated', id: feed_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(Feed.is_feed(feed));
      assert(feed.active !== false);
      const current_date = new Date();
      feed.deactivationReasonText = reason;
      feed.deactivateDate = current_date;
      feed.active = false;
      feed.dateUpdated = current_date;
      request.source.put(feed);
    };
  });
}
