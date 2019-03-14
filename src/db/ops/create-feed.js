import {assert} from '/src/assert.js';
import {Feed, is_feed} from '/src/db/types/feed.js';
import filter_empty_properties from '/src/db/utils/filter-empty-properties.js';

export default function create_feed(conn, channel, feed) {
  return new Promise((resolve, reject) => {
    assert(is_feed(feed));

    // The model requires that a feed has a url
    assert(Feed.prototype.hasURL.call(feed));

    // If feed.active is true, then leave as true. If false, leave as false.
    // But if undefined, impute true. This allows the caller to create
    // inactive feeds
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
    filter_empty_properties(feed);

    let id = 0;
    const txn = conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (channel) {
        channel.postMessage({type: 'feed-created', id: id});
      }

      resolve(id);
    };

    const store = txn.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });
}
