import assert from '/src/assert.js';
import * as object from '/src/lang-utils/object-utils.js';
import * as types from './types.js';

export async function create_feed(session, feed) {
  assert(types.is_feed(feed));
  assert(feed_has_url(feed));

  // If feed.active is true, then leave as true. If false, leave as false. But
  // if undefined, impute true. This allows the caller to create inactive feeds
  if (feed.active === undefined) {
    feed.active = true;
  }

  feed.dateCreated = new Date();
  delete feed.dateUpdated;

  object.filter_empty_properties(feed);

  const put_promise = new Promise(put_feed.bind(null, session.conn, feed));
  const id = await put_promise;

  if (session.channel) {
    const message = {type: 'feed-created', id: id};
    session.channel.postMessage(message);
  }

  return id;
}

// Return true if the feed has at least one url. Note this does not validate
// the url value, just that it is a non-empty string.
function feed_has_url(feed) {
  const urls = feed.urls;
  return Array.isArray(urls) && urls.length && typeof urls[0] === 'string' &&
      urls[0].length;
}

// By design, this does not settle until the transaction completes
function put_feed(conn, feed, resolve, reject) {
  let id = 0;
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(id);
  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = _ => id = request.result;
}
