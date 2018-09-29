import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

export async function update_feed(conn, channel, feed, transition) {
  assert(types.is_feed(feed));
  assert(feed_utils.is_valid_feed_id(feed.id));
  assert(feed.urls && feed.urls.length);
  assert(transition === undefined || typeof transition === 'function');

  object.filter_empty_properties(feed);
  feed.dateUpdated = new Date();

  await update_feed_internal(conn, feed, transition);

  if (channel) {
    channel.postMessage({type: 'feed-updated', id: feed.id});
  }
}

function update_feed_internal(conn, feed, transition) {
  return new Promise(update_feed_executor.bind(null, conn, feed, transition));
}

function update_feed_executor(conn, feed, transition, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;
  const store = txn.objectStore('feed');

  if (!transition) {
    store.put(feed);
    return;
  }

  // Read, transition, then overwrite
  const find_request = store.get(feed.id);
  find_request.onsuccess = event => {
    const old_feed = event.target.result;
    if (!old_feed) {
      const msg = 'Failed to find feed to update for id ' + feed.id;
      const err = new Error(msg);
      reject(err);
      return;
    }

    if (!types.is_feed(old_feed)) {
      const msg = 'Matched object is not of type feed for id ' + feed.id;
      const err = new Error(msg);
      reject(err);
      return;
    }

    // NOTE: the reason for the try/catch is that this exception otherwise
    // occurs in a deferred setting and is not automatically converted into a
    // rejection

    let new_feed;
    try {
      new_feed = transition(old_feed);
    } catch (error) {
      reject(error);
      return;
    }

    if (!types.is_feed(new_feed)) {
      const msg =
          'Transitioning feed did not produce a valid feed object for id ' +
          feed.id;
      const err = new Error(msg);
      reject(err);
      return;
    }

    store.put(new_feed);
  };
}
