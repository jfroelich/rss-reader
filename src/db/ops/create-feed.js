import Connection from '/src/db/connection.js';
import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import normalize_feed from '/src/db/ops/normalize-feed.js';
import sanitize_feed from '/src/db/ops/sanitize-feed.js';
import validate_feed from '/src/db/ops/validate-feed.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function create_feed(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(is_feed(feed));

    // A newly created feed should not have an id, and null is not allowed
    assert(feed.id === undefined);

    // The model requires that a feed has a url
    assert(locatable.has_url(feed));

    // If feed.active is true, then leave as true. If false, leave as false.
    // But if undefined, impute true. This allows the caller to create
    // inactive feeds
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.created_date = new Date();
    delete feed.updated_date;

    normalize_feed(feed);
    sanitize_feed(feed);
    filter_empty_properties(feed);
    validate_feed(feed);

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
    const request = store.add(feed);
    request.onsuccess = _ => id = request.result;
  });
}
