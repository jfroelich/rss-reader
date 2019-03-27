import Connection from '/src/db/connection.js';
import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import normalize_feed from '/src/db/ops/normalize-feed.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function create_feed(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(is_feed(feed));

    // The model requires that a feed has a url
    assert(locatable.has_url(feed));

    // If feed.active is true, then leave as true. If false, leave as false.
    // But if undefined, impute true. This allows the caller to create
    // inactive feeds
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.date_created = new Date();
    delete feed.date_updated;

    normalize_feed(feed);
    filter_empty_properties(feed);

    let id = 0;
    const txn = conn.conn.transaction('feeds', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'feed-created', id: id});
      }

      resolve(id);
    };

    const store = txn.objectStore('feeds');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });
}
