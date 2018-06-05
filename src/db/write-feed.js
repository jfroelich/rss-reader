import {is_feed} from '/src/feed.js';
import {filter_empty_properties} from '/src/lib/lang/filter-empty-properties.js';
import {list_is_empty} from '/src/lib/lang/list.js';

// TODO: tests

// Creates or updates a feed in the database. Broadcasts a message to the
// channel when finished
// @param conn {IDBDatabase} an open database connection
// @param channel {BroadcastChannel} a channel to send messages about a
// feed being stored
// @param feed {object} the feed object to store
// @throws {TypeError} when feed is not a feed type
// @throws {InvalidStateError} when channel closed at time of posting message,
// note this occurs after internal transaction committed
// @throws {DOMException} database errors
// @return {Promise} resolves to the stored feed
export function write_feed(conn, channel, feed) {
  return new Promise(executor.bind(null, conn, channel, feed));
}

function executor(conn, channel, feed, resolve, reject) {
  assert(is_feed(feed));
  assert(!list_is_empty(feed.urls));

  filter_empty_properties(feed);

  const is_create = !('id' in feed);
  if (is_create) {
    feed.active = true;
    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  } else {
    feed.dateUpdated = new Date();
  }

  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete =
      txn_oncomplete.bind(null, channel, is_create, feed.id, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);

  // request.result is the feed id in both create and update cases, but it only
  // matters in the create case
  if (is_create) {
    request.onsuccess = _ => feed.id = request.result;
  }
}

function txn_oncomplete(channel, is_create, feed_id, callback, event) {
  const message = {type: 'feed-written', id: feed_id, create: is_create};
  channel.postMessage(message);
  callback(feed_id);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion error');
  }
}
