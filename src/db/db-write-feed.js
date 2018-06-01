import {db_sanitize_feed} from '/src/db/db-sanitize-feed.js';
import {is_feed, is_valid_feed_id} from '/src/feed.js';
import {filter_empty_properties} from '/src/lib/lang/filter-empty-properties.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import {log} from '/src/log.js';

// Creates or updates a feed in the database. Broadcasts a message to the
// channel when finished. Unless options.sanitize is true this inserts the feed
// as is.
// @context-param conn {IDBDatabase} an open database connection
// @context-param channel {BroadcastChannel} a channel to send messages about a
// feed being stored
// @param feed {object} the feed object to store
// @param options {object} optional
// @option validate {Boolean} defaults to false, if true then feed's properties
// are validated, and the returned promise rejects if the feed is invalid
// @option sanitize {Boolean} defaults to false, if true then the feed is
// sanitized prior to storage
// @option set_date_updated {Boolean} defaults to false, if true then the feed's
// dateUpdated property is set to the time this function is called
// @throws {TypeError} when feed is not a feed type
// @throws {InvalidStateError} when channel closed at time of posting message,
// note this occurs after internal transaction committed
// @throws {DOMException} database errors
// @return {Promise} resolves to the stored feed
// TODO: tests
// TODO: deprecate validate option, just have the caller call it explicitly
// TODO: deprecate sanitize option, caller should call explicitly
// TODO: deprecate set-date-updated option, caller should call it explicitly
// TODO: create module validate, require caller to explicitly call it as
// additional optional boilerplate.
// TODO: if caller must sanitize, then no longer need to return object, just
// return id

// Creates or updates the given feed in storage
export function db_write_feed(feed, options = {}) {
  return new Promise(executor.bind(this, feed, options));
}

function executor(feed, options, resolve, reject) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter ' + JSON.stringify(feed));
  }

  // This is not caught by validation, but it is important to prevent storing
  // location-less feeds in the data
  if (list_is_empty(feed.urls)) {
    throw new TypeError(
        'At least one feed url is required ' + JSON.stringify(feed));
  }

  if (options.validate && !db_validate_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (options.sanitize) {
    db_sanitize_feed(feed, options);
  }

  // Always filter empty properties
  feed = filter_empty_properties(feed);

  const is_update = 'id' in feed;
  const prefix = is_update ? 'updating' : 'creating';
  log('%s: %s feed', db_write_feed.name, prefix, list_peek(feed.urls));

  if (is_update) {
    if (options.set_date_updated) {
      feed.dateUpdated = new Date();
    }
  } else {
    feed.active = true;
    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, is_update, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);

  // The result of using `IDBObjectStore.prototype.put` is the keypath of the
  // inserted object, so here it is always the new feed object's id, regardless
  // of whether the feed is being created or overwritten.
  if (!is_update) {
    request.onsuccess = _ => feed.id = request.result;
  }
}

function txn_oncomplete(is_update, feed, callback, event) {
  const message = {type: 'feed-written', id: feed.id, create: !is_update};
  log('%s: %o', db_write_feed.name, message);
  this.channel.postMessage(message);
  callback(feed);
}

// TODO: finish all checks
function db_validate_feed(feed) {
  if ('id' in feed && !is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  if ('urls' in feed && !Array.isArray(feed.urls)) {
    return false;
  }

  return true;
}
