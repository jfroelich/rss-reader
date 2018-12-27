import assert from '/src/assert.js';
import * as object from '/src/db/object-utils.js';
import * as types from './types.js';

export async function create_feed(session, feed) {
  assert(types.is_feed(feed));
  assert(Array.isArray(feed.urls));
  assert(feed.urls.length);
  assert(typeof feed.urls[0] === 'string');
  assert(feed.urls[0].length); // better to be explicit

  // If feed.active is true, then leave as true. If false, leave as false. But
  // if undefined, impute true. This allows the caller to create inactive feeds
  if (feed.active === undefined) {
    feed.active = true;
  }

  feed.dateCreated = new Date();
  delete feed.dateUpdated;

  object.filter_empty_properties(feed);

  // This intentionally does not settle until the transaction completes
  const id = await new Promise((resolve, reject) => {
    let id = 0;
    const txn = conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => resolve(id);
    const store = txn.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });

  if (session.channel) {
    const message = {type: 'feed-created', id: id};
    session.channel.postMessage(message);
  }

  return id;
}
