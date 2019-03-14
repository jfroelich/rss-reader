import {assert} from '/src/assert.js';
import {Feed} from '/src/db/types/feed.js';

export default function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || value instanceof URL);
    assert(mode !== 'id' || Feed.isValidId(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('feed');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('feed');

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
        if (Feed.isValidId(feed_id)) {
          feed = new Feed();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}
