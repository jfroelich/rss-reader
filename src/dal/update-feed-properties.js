import {assert} from '/src/assert/assert.js';
import * as Feed from '/src/data-layer/feed.js';

export function update_feed_properties(
    conn, channel, feed_id, name, value, extra_props = {}) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    assert(typeof name === 'string' && name);
    assert(name !== 'id');  // refuse setting this particular prop

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-written', id: feed_id, property: name});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(feed);                // indicates bad id or unexpected state
      assert(Feed.is_feed(feed));  // corrupted state

      const run_date = new Date();

      if (name === 'active') {
        // TODO: use asserts here
        if (feed.active && value) {
          console.error(
              'Tried to activate active feed (invalid state) %d', feed_id);
          return;
        } else if (!feed.active && !value) {
          console.error(
              'Tried to deactivate inactive feed (invalid state) %d', feed_id);
          return;
        }

        // Set functional dependencies
        if (value === true) {
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        } else if (value === false) {
          if (typeof extra_props.reason === 'string') {
            feed.deactivationReasonText = extra_props.reason;
          } else {
            delete feed.deactivationReasonText;
          }
          feed.deactivateDate = run_date;
        } else {
          // If undefining, cleanup
          // TODO: is this case of undefined even allowed? might not make sense
          // TODO: if these fields do not even exist, should I try to no-op?
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        }
      }

      if (typeof value === 'undefined') {
        // Remove the property rather than set to undefined. Normally frowned
        // upon because we want to maintain v8 object shape, but in this case it
        // actually reduces disk space.
        delete feed[name];
      } else {
        feed[name] = value;
      }

      if (name !== 'dateUpdated') {
        feed.dateUpdated = run_date;
      }

      request.source.put(feed);
    };
  });
}
