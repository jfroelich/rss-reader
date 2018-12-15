import assert from '/src/assert.js';
import * as object from '/src/base/object-utils.js';
import * as errors from './errors.js';
import * as feed_utils from './feed-utils.js';
import * as types from './types.js';

// TODO: consider a stronger level of validation of incoming properties,
// possibly using some kind of a schema of known properties. Or make this less
// of a concern here, and more of a concern of some external validation.

// TODO: throw the proper errors here, this is also causing activate-feed-test
// to fail

export async function update_feed(session, feed, overwrite) {
  // If overwriting, the new feed must be valid. If partial update, the new
  // feed is just a bag of properties, but it at least must be an object.
  if (overwrite) {
    assert(types.is_feed(feed));
  } else {
    assert(typeof feed === 'object');
  }

  // In both overwriting and partial situation, feed.id must be valid
  assert(feed_utils.is_valid_feed_id(feed.id));

  // If overwriting, the feed must have a url. If partial, feed is just a bag
  // of properties.
  // TODO: use feed_utils.has_url(feed) here (once it is implemented)
  if (overwrite) {
    assert(feed.urls && feed.urls.length);
  }

  // If overwriting, remove unused properties. If partial, feed is just a bag
  // of properties and undefined keys signify properties that should be removed
  // from the old feed.
  if (overwrite) {
    object.filter_empty_properties(feed);
  }

  // If overwriting, set the dateUpdated property. If partial, it will be set
  // later by the partial logic.
  if (overwrite) {
    feed.dateUpdated = new Date();
  }

  const ufe = update_feed_executor.bind(null, session.conn, feed, overwrite);
  await new Promise(ufe);

  // NOTE: under this new regime, feed-activated and feed-deactivated message
  // types are no longer produced. To test for feed-activated, listen for
  // feed-updated and then check if 'active' in props and if it is true. I am
  // still not convinced that is even necessary but I am supporting it for now.
  // I do not like sending the entire value object over the wire.

  if (session.channel) {
    const message = {type: 'feed-updated', id: feed.id, feed: undefined};
    // Only send it over the wire if doing a partial update
    if (!overwrite) {
      message.feed = feed;
    }
    session.channel.postMessage(message);
  }
}

function update_feed_executor(conn, feed, overwrite, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;
  const store = txn.objectStore('feed');

  // In the overwrite case, it is simple and we are done
  if (overwrite) {
    store.put(feed);
    return;
  }

  const request = store.get(feed.id);
  request.onsuccess = find_feed_onsuccess.bind(request, feed, reject);
}

function find_feed_onsuccess(props, reject, event) {
  const feed = event.target.result;

  if (!feed) {
    const message = 'Failed to find feed to update for id ' + props.id;
    const error = new errors.NotFoundError(message);
    reject(error);
    return;
  }

  if (!types.is_feed(feed)) {
    const message = 'Matched object is not of type feed for id ' + props.id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  // Before overwriting individual properties, validate certain property value
  // transitions. Assume each property is a known feed property with a valid
  // value.

  // If you want to activate a feed, it must not already be active. If you want
  // to update the feed regardless, you should not have specified the active
  // property in the partial use case.
  if (props.active === true && feed.active === true) {
    const message = 'Cannot activate already active feed with id ' + feed.id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  // Similarly, should not try to deactivate an inactive feed.
  if (props.active === false && feed.active === false) {
    const message = 'Cannot deactivate inactive feed with id ' + feed.id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  // Setup any auto-transitions.

  // When activating a feed, two other properties related to deactivation should
  // be specified as undefined to indicate intent to remove.
  if (props.active === true) {
    if (!('deactivationReasonText' in props)) {
      props.deactivationReasonText = undefined;
    }

    if (!('deactivateDate' in props)) {
      props.deactivateDate = undefined;
    }
  }

  // When deactivating, record the date
  if (props.active === false) {
    if (!('deactivateDate' in props)) {
      props.deactivateDate = new Date();
    }
  }

  // Overwrite the old property values with the new property values for those
  // properties explicitly specified in props. If a property is present but
  // undefined, that means the caller's intent was to remove the property.

  for (const key in props) {
    // There is no point in overwriting id. This is harmless but I want to
    // treat id as sort of immutable.
    if (key === 'id') {
      continue;
    }

    const value = props[key];
    if (value === undefined) {
      delete feed[key];
    } else {
      feed[key] = value;
    }
  }

  feed.dateUpdated = new Date();

  event.target.source.put(feed);
}
