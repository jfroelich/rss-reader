import {feed_create, feed_is_valid, feed_prepare, is_feed} from '/src/objects/feed.js';

export function rdr_update_feed(
    conn, channel, feed, validate = true, sanitize = true,
    set_date_updated = false) {
  if (validate) {
    assert(feed_is_valid(feed));
  } else {
    assert(is_feed(feed));
  }

  let clean_feed;
  if (sanitize) {
    clean_feed = feed_prepare(feed);
  } else {
    clean_feed = Object.assign(feed_create(), feed);
  }

  if (set_date_updated) {
    clean_feed.dateUpdated = new Date();
  }

  return new Promise(executor.bind(null, conn, channel, clean_feed));
}

function executor(conn, channel, feed, resolve, reject) {
  const shared = {id: undefined, channel: channel, callback: resolve};

  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, shared);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = request_onsuccess.bind(request, shared);
  // Do not explicitly listen for request error, it implicitly bubbles up to txn
}

function txn_oncomplete(shared, event) {
  // Suppress invalid state error when channel is closed in non-awaited call
  if (shared.channel) {
    try {
      shared.channel.postMessage({type: 'feed-updated', id: shared.id});
    } catch (error) {
      console.debug(error);
    }
  }
  shared.callback(shared.id);
}

function request_onsuccess(shared, event) {
  // On create, the result is the new value of the auto-incremented feed id
  // Not sure what happens on update
  shared.id = event.target.result;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
