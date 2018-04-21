import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';

export function write_feed_property(feed_id, name, value, extra_props = {}) {
  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  if (typeof name !== 'string') {
    throw new TypeError('Invalid name type ' + name);
  }

  if (!name) {
    throw new TypeError('Empty property name');
  }

  // The current level of property validation is relatively weak, given that
  // it should never occur and we are the sole users of this api call. Therefore
  // name validation is minimal. Hereinafter, assume the name is canonical.
  // TODO: consider a stronger check, possibly using some kind of a schema of
  // known properties

  // Always refuse calls that try to update id. The id property cannot be
  // updated, because it is the keypath to the object. Changing the id is
  // nonsensical here because changing the id effectively means inserting a new
  // object or overwriting some other object, or a pointless noop in the case of
  // updating itself. Because it is so nonsensical it is elevated to programmer
  // error level treatment worthy of a thrown error.

  // NOTE: in the previous approach of using specialized calls like
  // activate-feed and deactivate-feed, there was no need for this check. This
  // is an example of the drawback of using a more generic (less-specialized)
  // approach. I did not even initially consider this drawback when deciding
  // to move forward on implemenation. There is the possibility I
  // over-generalized and want to reconsider something more granular (more
  // specific to the problem) that is in between set-any-property and
  // set-particular-property. Some kind of middle ground like
  // set-writable-properties or something, where I qualify the subset of
  // properties amenable to this approach.

  if (name === 'id') {
    throw new TypeError('Should not try to set id this way');
  }

  // TODO: maybe validation is wasteful or paranoid?
  if (!is_valid_type_for_property(name, value)) {
    throw new TypeError('Invalid value type for property ' + name);
  }

  return new Promise(executor.bind(this, feed_id, name, value, extra_props));
}

// Return whether the property with the given name may contain the value
// Not currently exhaustive, may use switch statement
// TODO: maybe this should somehow borrow from some external
// defined-once-in-one-place (singleton?) schema definition that has
// per-property settings of type and allows-null(empty). I could also do a
// check above for whether the property exists in the schema in that case
function is_valid_type_for_property(name, value) {
  const value_type = typeof value;
  const active_value_types = ['boolean', 'undefined'];

  if (name === 'active' && !active_value_types.includes(value_type)) {
    return false;
  }

  return true;
}

function executor(feed_id, name, value, extra_props, resolve, reject) {
  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed_id, name, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess =
      request_onsuccess.bind(this, feed_id, name, value, extra_props);
}

function txn_oncomplete(feed_id, name, callback, event) {
  this.console.debug(
      '%s: updated feed %d property %s', write_feed_property.name, feed_id,
      name);
  this.channel.postMessage({type: 'feed-updated', id: feed_id, property: name});
  callback();
}

function request_onsuccess(feed_id, name, value, extra_props, event) {
  const feed = event.target.result;
  if (!feed) {
    this.console.warn('%s: feed not found %d', request_onsuccess.name, feed_id);
    return;
  }

  if (!is_feed(feed)) {
    this.console.warn(
        '%s: bad object type %d %o', request_onsuccess.name, feed_id, feed);
    return;
  }

  const run_date = new Date();

  if (name === 'active') {
    if (feed.active && value) {
      this.console.warn(
          '%s: tried to activate active feed (invalid state) %d',
          request_onsuccess.name, feed_id);
      return;
    } else if (!feed.active && !value) {
      this.console.warn(
          '%s: tried to deactivate inactive feed (invalid state) %d',
          request_onsuccess.name, feed_id);
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
    // Remove the property rather than set to undefined. Normally frowned upon
    // because we want to maintain v8 object shape, but in this case it actually
    // reduces disk space.
    delete feed[name];
  } else {
    feed[name] = value;
  }

  if (name !== 'dateUpdated') {
    feed.dateUpdated = run_date;
  }

  const feed_object_store = event.target.source;
  feed_object_store.put(feed);
}
