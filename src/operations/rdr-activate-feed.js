import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {feed_is_valid_id, is_feed} from '/src/objects/feed.js';

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

export function rdr_activate_feed(
    conn, channel = null_channel, console = console_stub, feed_id) {
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
  request.onsuccess = request_onsuccess.bind(request, feed_id);
}

function txn_oncomplete(channel, feed_id, callback, event) {
  channel.postMessage({type: 'feed-activated', id: feed_id});
  resolve();
}

function request_onsuccess(feed_id, event) {
  const feed = event.target.result;
  const store = event.target.source;

  if (!feed) {
    console.warn('Failed to find feed by id', feed_id);
    return;
  }

  if (!is_feed(feed)) {
    console.warn('Matched feed object is not a feed', feed_id, feed);
    return;
  }

  if (feed.active) {
    console.warn('Tried to activate already-active feed', feed_id);
    return;
  }

  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivateDate;

  feed.dateUpdated = new Date();
  store.put(feed);
}

function noop() {}
