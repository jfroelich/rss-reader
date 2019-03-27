import Connection from '/src/db/connection.js';
import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import normalize_feed from '/src/db/ops/normalize-feed.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';
import is_iterable from '/src/lib/is-iterable.js';

export default function create_feeds(conn, feeds) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(is_iterable(feeds));

    for (const feed of feeds) {
      assert(is_feed(feed));
      assert(locatable.has_url(feed));
    }

    for (const feed of feeds) {
      normalize_feed(feed);
      filter_empty_properties(feed);

      // Default to active if not set, but leave as is if false
      if (feed.active === undefined) {
        feed.active = true;
      }
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    }

    const ids = [];
    const txn = conn.conn.transaction('feeds', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (conn.channel) {
        for (const id of ids) {
          conn.channel.postMessage({type: 'feed-created', id: id});
        }
      }

      resolve(ids);
    };

    function request_onsuccess(event) {
      ids.push(event.target.result);
    }

    const store = txn.objectStore('feeds');
    for (const feed of feeds) {
      const request = store.put(feed);
      request.onsuccess = request_onsuccess;
    }
  });
}
