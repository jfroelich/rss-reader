import {Feed, is_feed} from '/src/db/object/feed.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function create_feeds(conn, channel, feeds) {
  return new Promise((resolve, reject) => {
    // TODO: assert is iterable
    assert(feeds);
    for (const feed of feeds) {
      assert(is_feed(feed));
      assert(Feed.prototype.hasURL.call(feed));
    }

    for (const feed of feeds) {
      filter_empty_properties(feed);
      // Allow explicit false
      if (feed.active === undefined) {
        feed.active = true;
      }
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    }

    const ids = [];
    const txn = conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (channel) {
        for (const id of ids) {
          channel.postMessage({type: 'feed-created', id: id});
        }
      }

      resolve(ids);
    };

    function request_onsuccess(event) {
      ids.push(event.target.result);
    }

    const store = txn.objectStore('feed');
    for (const feed of feeds) {
      const request = store.put(feed);
      request.onsuccess = request_onsuccess;
    }
  });
}
