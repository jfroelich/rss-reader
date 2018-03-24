import {feed_is_valid} from '/src/app/objects/feed.js';
import * as rdb from '/src/rdb/rdb.js';

// TODO: when updating, is put result still the feed id? I know
// that result is feed id when adding, but what about updating? Review
// the documentation on IDBObjectStore.prototype.put
// So ... double check and warrant this resolves to an id

// TODO: if awaited, I'd prefer to throw in case of channel postMessage error.
// How? Or, should it really just be an error, and the caller is responsible for
// keeping this open?

// Create or update a feed in the database
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel} optional
// @param feed {object}
// @param validate {Boolean} optional, if true then feed is validated
export function update_feed(conn, channel, feed, validate = true) {
  return new Promise((resolve, reject) => {
    if (validate) {
      assert(feed_is_valid(feed));
    } else {
      assert(rdb.is_feed(feed));
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
  });
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
