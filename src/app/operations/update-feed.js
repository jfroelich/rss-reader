import {feed_is_valid, is_feed} from '/src/app/objects/feed.js';

export function update_feed(
    conn, channel, feed, validate = true, set_date_updated = false) {
  if (validate) {
    assert(feed_is_valid(feed));
  } else {
    assert(is_feed(feed));
  }

  return new Promise(
      executor.bind(null, conn, channel, feed, set_date_updated));
}

function executor(conn, channel, feed, set_date_updated, resolve, reject) {
  if (set_date_updated) {
    feed.dateUpdated = new Date();
  }

  const txn = conn.transaction('feed', 'readwrite');
  const store = txn.objectStore('feed');
  const request = store.put(feed);

  request.onsuccess = _ => {
    const feed_id = request.result;
    // Suppress invalid state error when channel is closed in non-awaited call
    if (channel) {
      try {
        channel.postMessage({type: 'feed-updated', id: feed_id});
      } catch (error) {
        console.debug(error);
      }
    }
    resolve(feed_id);
  };
  request.onerror = _ => reject(request.error);
}


function assert(value) {
  if (!value) throw new Error('Assertion error');
}
