import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {feed_is_valid_id} from '/src/objects/feed.js';

const channel_stub = {
  name: 'stub',
  postMessage: noop,
  close: noop
};

export function rdr_deactivate_feed(
    conn, channel = channel_stub, console = console_stub, feed_id,
    reason_text) {
  if (!feed_is_valid_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }
  return new Promise(
      executor.bind(null, conn, channel, console, feed_id, reason_text));
}

function executor(
    conn, channel, console, feed_id, reason_text, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, console, resolve, feed_id);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(request, reason_text);
}

function txn_oncomplete(channel, console, callback, feed_id, event) {
  console.debug('Deactivated feed', feed_id);
  channel.postMessage({type: 'feed-deactivated', id: feed_id});
  callback();
}

function request_onsuccess(reason_text, event) {
  const feed = event.target.result;
  const store = event.target.source;

  if (!feed) {
    console.warn('Failed to find feed');
    return;
  }

  if (!is_feed(feed)) {
    console.warn('Matched object not a feed', feed);
    return;
  }

  if (feed.active === false) {
    console.warn('Feed is already inactive', feed);
    return;
  }

  feed.active = false;
  feed.deactivationDate = new Date();
  feed.deactivationReasonText = reason_text;
  feed.dateUpdated = new Date();
  store.put(feed);
}

function noop() {}
