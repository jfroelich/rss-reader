import * as rdb from '/src/rdb/rdb.js';

export function activate_feed(conn, channel, feed_id) {
  return new Promise((resolve, reject) => {
    assert(rdb.feed_is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = txn_oncomplete.bind(txn, channel, resolve);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = request_onsuccess.bind(request, store);
  });
}

function txn_oncomplete(channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'feed-activated', id: feed_id});
  }
  resolve();
}

// TODO: get the store from the event itself rather than passing store as
// parameter
function request_onsuccess(store, event) {
  const feed = event.target.result;

  // TODO: would it be better, instead of throwing, to just log an error message
  // and operate as a no-op or something to that effect? This is not really a
  // programming error.
  assert(rdb.is_feed(feed));
  assert(!feed.active || !('active' in feed));

  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivateDate;

  feed.dateUpdated = new Date();
  store.put(feed);
}


function assert(value) {
  if (!value) throw new Error('Assertion error');
}
