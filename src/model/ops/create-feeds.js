import {assert} from '/src/assert.js';
import {Feed, is_feed} from '/src/model/types/feed.js';
import filter_empty_properties from '/src/model/utils/filter-empty-properties.js';

export default function create_feeds(conn, feeds) {
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
    const txn = conn.conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      for (const id of ids) {
        conn.channel.postMessage({type: 'feed-created', id: id});
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
