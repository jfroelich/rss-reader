import assert from '/src/assert/assert.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

export async function create_feed(conn, channel, feed) {
  assert(types.is_feed(feed));
  assert(Array.isArray(feed.urls));
  assert(feed.urls.length);

  object.filter_empty_properties(feed);

  // Allow for explicit 'false'
  if (feed.active === undefined) {
    feed.active = true;
  }

  feed.dateCreated = new Date();
  delete feed.dateUpdated;

  const id = await create_feed_internal(conn, feed);

  if (channel) {
    channel.postMessage({type: 'feed-created', id: id});
  }

  return id;
}

function create_feed_internal(conn, feed) {
  return new Promise(create_feed_executor.bind(null, conn, feed));
}

function create_feed_executor(conn, feed, resolve, reject) {
  let id = 0;
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(id);
  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = _ => id = request.result;
}
