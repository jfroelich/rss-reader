import {is_feed} from '/src/feed.js';
import {filter_empty_properties} from '/src/lib/lang/filter-empty-properties.js';
import {list_is_empty} from '/src/lib/lang/list.js';

// Creates or updates a feed in the database. Broadcasts a message to the
// channel when finished
// @context-param conn {IDBDatabase} an open database connection
// @context-param channel {BroadcastChannel} a channel to send messages about a
// feed being stored
// @param feed {object} the feed object to store
// @throws {TypeError} when feed is not a feed type
// @throws {InvalidStateError} when channel closed at time of posting message,
// note this occurs after internal transaction committed
// @throws {DOMException} database errors
// @return {Promise} resolves to the stored feed
// TODO: tests
// TODO: revert to not using context, just use params again
// TODO: consider setting dateUpdated in updated case automatically, always, and
// not allowing custom dateUpdated
export function db_write_feed(feed) {
  return new Promise(executor.bind(this, feed));
}

function executor(feed, resolve, reject) {
  assert(is_feed(feed));
  assert(!list_is_empty(feed.urls));

  feed = filter_empty_properties(feed);

  const is_create = !('id' in feed);
  if (is_create) {
    feed.active = true;
    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, is_create, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);

  // request.result is the feed id in both create and update cases, but it only
  // matters in the create case
  if (is_create) {
    request.onsuccess = _ => feed.id = request.result;
  }
}

function txn_oncomplete(is_create, feed, callback, event) {
  const message = {type: 'feed-written', id: feed.id, create: is_create};
  this.channel.postMessage(message);
  callback(feed.id);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion error');
  }
}
