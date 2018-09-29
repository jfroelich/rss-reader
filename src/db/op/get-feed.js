import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';

export function get_feed(session, mode = 'id', value, key_only) {
  assert(mode !== 'url' || (value && typeof value.href === 'string'));
  assert(mode !== 'id' || feed_utils.is_valid_feed_id(value));
  assert(mode !== 'id' || !key_only);

  return get_feed_internal(session.conn, mode, value, key_only);
}

function get_feed_internal(conn, mode, value, key_only) {
  return new Promise(get_feed_executor.bind(null, conn, mode, value, key_only));
}

function get_feed_executor(conn, mode, value, key_only, resolve, reject) {
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

  request.onsuccess = _ => {
    let feed;
    if (key_only) {
      const feed_id = request.result;
      if (feed_utils.is_valid_feed_id(feed_id)) {
        feed = feed_utils.create_feed();
        feed.id = feed_id;
      }
    } else {
      feed = request.result;
    }

    resolve(feed);
  };
}
