import {create_feed, is_valid_feed_id} from '/src/feed.js';

// TODO: write tests

// TODO: what if instead I use two different request_onsuccess handlers,
// one for getKey and one for get. This reduces the branching in the handler.
// Would it be clearer? More or less performant?

// Asynchronously finds a feed in the database
// @param conn {IDBDatabase} an open database connection
// @param mode {String} the type of query, if mode is undefined then it is query
// by id, modes are 'url', 'id', lowercase only
// @param value {any} the value of the key to look for
// @option key_only {Boolean} if true then only the matching key is loaded
// @return {Promise} resolve to the matching feed or undefined
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise(executor.bind(null, conn, mode, value, key_only));
}

function executor(conn, mode, value, key_only, resolve, reject) {
  assert(['url', 'id'].includes(mode));
  assert(mode !== 'url' || is_url(value));
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
  } else {
    request = store.get(value);
  }
  request.onsuccess = request_onsuccess.bind(request, key_only, resolve);
}

function request_onsuccess(key_only, callback, event) {
  let feed;
  if (key_only) {
    const feed_id = event.target.result;
    if (is_valid_feed_id(feed_id)) {
      feed = create_feed();
      feed.id = feed_id;
    }
  } else {
    feed = event.target.result;
  }

  callback(feed);
}

function is_url(value) {
  return value && typeof value.href === 'string';
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
