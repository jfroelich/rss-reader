import {feed_is_valid_id} from '/src/objects/feed.js';

export function deactivate_feed(conn, channel, feed_id, reason_text) {
  assert(feed_is_valid_id(feed_id));
  return new Promise(executor.bind(null, conn, channel, feed_id, reason_text));
}

function executor(conn, channel, feed_id, reason_text, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, resolve, feed_id);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(request, reason_text);
}

function txn_oncomplete(channel, callback, feed_id, event) {
  if (channel) {
    channel.postMessage({type: 'feed-deactivated', id: feed_id});
  }
  resolve();
}

function request_onsuccess(reason_text, event) {
  const feed = event.target.result;
  const store = event.target.source;

  // TODO: rather than assert/reject when inactive, maybe just skip?

  assert(feed);
  assert(feed.active || !('active' in feed));
  feed.active = false;
  feed.deactivationDate = new Date();
  feed.deactivationReasonText = reason_text;
  feed.dateUpdated = new Date();
  store.put(feed);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
