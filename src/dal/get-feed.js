import {assert} from '/src/assert/assert.js';
import * as Feed from '/src/data-layer/feed.js';

// Find a feed in the database by id or by url
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || Feed.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');

    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      let feed;
      if (key_only) {
        const feed_id = request.result;
        if (Feed.is_valid_id(feed_id)) {
          feed = Feed.create();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}
