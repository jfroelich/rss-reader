import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';

// UNFINISHED

// TODO: side note this no longer posts feed-activated/deactivated type
// messages, it just overloads feed-updated with an extra property. I have to
// take this change in behavior into account when refactoring activate-feed and
// deactivate-feed and corresponding callers

export function write_feed_property(feed_id, name, value) {
  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  // name must be a string
  if (typeof name !== 'string') {
    throw new TypeError('Invalid name type ' + name);
  }

  // name must be non-empty
  if (!name) {
    throw new TypeError('Empty property name');
  }

  // From this point onward assume name is canonical

  // TODO: Right? Think through this check. It makes no sense to try to do this,
  // right? Refuse permanently and treat this attempt as a programming error.
  if (name === 'id') {
    throw new TypeError('Should not try to set id this way');
  }

  // TODO: maybe validation is wasteful or paranoid?
  if (!is_valid_type_for_property(name, value)) {
    throw new TypeError('Invalid value type for property ' + name);
  }

  return new Promise(executor.bind(this, feed_id, name, value));
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

function executor(feed_id, name, value, resolve, reject) {
  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed_id, name, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(this, feed_id, name, value);
}

function txn_oncomplete(feed_id, name, callback, event) {
  this.console.debug('Updated feed property', feed_id, name);
  this.channel.postMessage({type: 'feed-updated', id: feed_id, property: name});
  callback();
}

function request_onsuccess(feed_id, name, value, event) {
  const feed = event.target.result;
  if (!feed) {
    this.console.warn('Failed to find feed by id', feed_id);
    return;
  }

  if (!is_feed(feed)) {
    this.console.warn('Invalid feed object type (corrupt db?)', feed_id, feed);
    return;
  }

  // Special case handling for the 'active' property
  if (name === 'active') {
    // Check state sanity
    // TODO: why? does it really matter?
    // TODO: are these error worthy?
    if (feed.active && value) {
      this.console.warn(
          'Tried to activate active feed (invalid state)', feed_id);
      return;
    } else if (!feed.active && !value) {
      this.console.warn(
          'Tried to deactivate inactive feed (invalid state)', feed_id);
      return;
    }

    // Set functional dependencies
    if (value === true) {
      // If activating, cleanup
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
    } else if (value === false) {
      // If deactivating, initialize
      // TODO: gotta get reason from somewhere
      // TODO: should date be consistent with date-updated?
      feed.deactivationReasonText = 'unimplemented!';
      feed.deactivateDate = new Date();
    } else {
      // If undefining, cleanup
      // TODO: is this case even allowed? might not make sense
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
    }
  }

  if (typeof value === 'undefined') {
    // Remove the property rather than set to undefined. Normally frowned upon
    // but in this case it actually reduces disk space.
    delete feed[name];
  } else {
    feed[name] = value;
  }

  // This behavior depends on the entire operation in all cases but for the case
  // where the property being updated is the date itself
  if (name !== 'dateUpdated') {
    feed.dateUpdated = new Date();
  }

  // Start a put request. We let a put error bubble up to the txn, and we do
  // not listen for the success event because we can just listen for txn
  // completion
  const feed_object_store = event.target.source;
  feed_object_store.put(feed);
}
