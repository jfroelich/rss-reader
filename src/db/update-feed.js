import {is_feed} from '/src/feed.js';
import {filter_empty_properties} from '/src/lib/lang/filter-empty-properties.js';

// Creates or updates a feed in the database
export function update_feed(conn, channel, feed) {
  return new Promise((resolve, reject) => {
    assert(is_feed(feed));
    assert(feed.urls && feed.urls.length);

    filter_empty_properties(feed);

    const is_create = !('id' in feed);
    if (is_create) {
      feed.active = true;
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    } else {
      feed.dateUpdated = new Date();
    }

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'feed-written', id: feed_id, create: is_create};
      channel.postMessage(message);
      resolve(feed_id);
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.put(feed);

    // result is id in both cases, but only care about create
    if (is_create) {
      request.onsuccess = _ => feed.id = request.result;
    }
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
