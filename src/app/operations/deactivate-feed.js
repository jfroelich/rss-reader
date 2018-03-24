import * as rdb from '/src/rdb/rdb.js';

// TODO: rather than assert/reject when inactive, maybe just skip?


export function deactivate_feed(conn, channel, feed_id, reason_text) {
  return new Promise((resolve, reject) => {
    assert(rdb.feed_is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = txn_oncomplete.bind(txn, channel, resolve, feed_id);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = request_onsuccess.bind(request, reason_text, store);
  });
}

function txn_oncomplete(channel, callback, feed_id, event) {
  if (channel) {
    channel.postMessage({type: 'feed-deactivated', id: feed_id});
  }
  resolve();
}

// TODO: get store from event, rather than using store parameter
function request_onsuccess(reason_text, store, event) {
  const feed = event.target.result;
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