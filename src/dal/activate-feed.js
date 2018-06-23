import {assert} from '/src/assert/assert.js';
import * as Feed from '/src/data-layer/feed.js';

// TODO: view must now handle feed-activated (previously feed-written)

export function activate_feed(conn, channel, feed_id) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-activated', id: feed_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(Feed.is_feed(feed));
      assert(feed.active !== true);
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.active = true;
      feed.dateUpdated = new Date();
      request.source.put(feed);
    };
  });
}
