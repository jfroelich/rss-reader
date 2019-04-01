import Connection from '/src/db/connection.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';

export default function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(mode !== 'url' || value instanceof URL);
    assert(mode !== 'id' || resource_utils.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.conn.transaction('feeds');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('feeds');

    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = event => {
      let feed;
      if (key_only) {
        const feed_id = request.result;
        if (resource_utils.is_valid_id(feed_id)) {
          feed = {};
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}
