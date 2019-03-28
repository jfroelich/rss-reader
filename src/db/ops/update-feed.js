import Connection from '/src/db/connection.js';
import {InvalidStateError, NotFoundError} from '/src/db/errors.js';
import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import * as locatable from '/src/db/locatable.js';
import normalize_feed from '/src/db/ops/normalize-feed.js';
import * as types from '/src/db/types.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function update_feed(conn, feed, overwrite) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    // If overwriting, the new feed must be valid. If partial update, the new
    // feed is just a bag of properties, but it at least must be an object.
    if (overwrite) {
      assert(is_feed(feed));
    } else {
      assert(typeof feed === 'object');

      // Allow the caller to either not specify magic or to specify it while
      // maintaining correctness so as to maintain the invariant property
      assert(feed.magic === undefined || feed.magic === types.FEED_MAGIC);
    }

    // In both overwriting and partial situation, feed.id must be valid
    assert(identifiable.is_valid_id(feed.id));

    // If overwriting, the feed must have a url. If partial, feed is just a
    // bag of properties.
    if (overwrite) {
      assert(locatable.has_url(feed));
    }

    // If overwriting, full overwrite. If partial, manually normalize
    // TODO: this violates abstraction
    if (overwrite) {
      normalize_feed(feed);
    } else {
      if (feed.title) {
        feed.title = feed.title.normalize();
      }
      if (feed.description) {
        feed.description = feed.description.normalize();
      }
    }

    // If overwriting, remove unused properties. If partial, feed is just a
    // bag of properties and undefined keys signify properties that should be
    // removed from the old feed.
    if (overwrite) {
      filter_empty_properties(feed);
    }

    // If overwriting, set the updated_date property. If partial, it will be
    // set later by the partial logic.
    // TODO: if this is set in both cases then there is no need for this?
    if (overwrite) {
      feed.updated_date = new Date();
    }

    const txn = conn.conn.transaction('feeds', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'feed-updated', id: feed.id});
      }

      resolve();
    };

    const store = txn.objectStore('feeds');

    // The overwrite case is simple
    if (overwrite) {
      store.put(feed);
      return;
    }

    // In the partial update case, we load the old feed, adjust some of its
    // properties, and then overwrite it
    const request = store.get(feed.id);
    request.onsuccess = function(event) {
      const old_feed = event.target.result;
      if (!old_feed) {
        const message = 'Failed to find feed to update for id ' + feed.id;
        const error = new NotFoundError(message);
        reject(error);
        return;
      }

      if (!is_feed(old_feed)) {
        const message = 'Matched object is not of type feed for id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Before overwriting individual properties, validate certain property
      // value transitions. Assume each property is a known feed property with
      // a valid value.

      // If you want to activate a feed, it must not already be active. If you
      // want to update the feed regardless, you should not have specified the
      // active property in the partial update use case.
      if (feed.active === true && old_feed.active === true) {
        const message =
            'Cannot activate already active feed with id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Similarly, should not try to deactivate an inactive feed.
      if (feed.active === false && old_feed.active === false) {
        const message = 'Cannot deactivate inactive feed with id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Setup auto-transitions
      // When activating a feed, two other properties related to deactivation
      // should be specified as undefined to indicate intent to remove.
      if (feed.active === true) {
        if (!('deactivation_reason' in feed)) {
          feed.deactivation_reason = undefined;
        }

        if (!('deactivation_date' in feed)) {
          feed.deactivation_date = undefined;
        }
      }

      // When deactivating, record the date
      if (feed.active === false) {
        if (!('deactivation_date' in feed)) {
          feed.deactivation_date = new Date();
        }
      }

      // Overwrite the old property values with the new property values for
      // those properties explicitly specified in props. If a property is
      // present but undefined, that means the caller's intent was to remove
      // the property.
      for (const key in feed) {
        // Treat id as immutable.
        if (key === 'id') {
          continue;
        }

        const value = feed[key];
        if (value === undefined) {
          delete old_feed[key];
        } else {
          old_feed[key] = value;
        }
      }

      old_feed.updated_date = new Date();
      event.target.source.put(old_feed);
    };
  });
}
