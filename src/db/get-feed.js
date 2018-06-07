import {create_feed, is_valid_feed_id} from '/src/feed.js';

// Find a feed in the database by id or by url
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || is_valid_feed_id(value));
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
        if (is_valid_feed_id(feed_id)) {
          feed = create_feed();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
