import {feed_is_valid_id, is_feed} from '/src/objects/feed.js';

// Mark a feed as active in the database
export function activate_feed(
    conn, channel = null_channel, console = null_console, feed_id) {
  // An invalid argument is a persistent programmer error, not a promise
  // rejection
  if (!feed_is_valid_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(executor.bind(null, conn, channel, console, feed_id));
}

function executor(conn, channel, feed_id, console, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, feed_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(request, store, feed_id);
}

function txn_oncomplete(channel, feed_id, callback, event) {
  channel.postMessage({type: 'feed-activated', id: feed_id});
  resolve();
}

function request_onsuccess(store, feed_id, event) {
  const feed = event.target.result;

  // The caller possibly tried to use a bad feed id
  if (!feed) {
    console.warn('Failed to find feed to activate with id', feed_id);
    return;
  }

  // The corresponding object is invalid/corrupted
  if (!is_feed(feed)) {
    console.warn('Matched feed object is invalid for feed id', feed_id);
    return;
  }

  // The corresponding object is in an invalid state
  if (feed.active) {
    console.warn('Tried to activate already-active feed with id', feed_id);
    return;
  }

  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivateDate;

  feed.dateUpdated = new Date();
  store.put(feed);
}

const null_channel = {
  postMessage: noop,
  close: noop
};

function noop() {}

const null_console = {
  warn: noop,
  log: noop,
  debug: noop
};
