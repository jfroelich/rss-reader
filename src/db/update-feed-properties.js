import {is_feed, is_valid_feed_id} from '/src/feed.js';

// Asynchronously updates one or more properties of a feed in the database. This
// uses single database transaction to ensure consistency. Once the database
// transaction completes, a message is sent to the channel.
//
// The dateUpdated property is automatically set to the current date unless the
// property itself is specified as one of the properties to change.
//
// @param conn {IDBDatabase} an open database connection
// @param channel {BroadcastChannel} an open channel to send messages to
// @param feed_id {Number} the id of the feed to update
// @param name {String} the name of the property to modify
// @param value {any} the new value of the property
// @param extra_props {object} a map of additional related key-value pairs to
// consult when setting the property
// @error {TypeError} bad parameters
// @error {DOMException} when a database error occurs
// @error {InvalidStateError} when the channel is closed at the time
// of posting messages, note that the transaction still committed
// @error {Error} when attempting to update the 'id' property, because this is
// not permitted
// @return {Promise} resolves to undefined
export function update_feed_properties(
    conn, channel, feed_id, name, value, extra_props = {}) {
  return new Promise(
      executor.bind(null, conn, channel, feed_id, name, value, extra_props));
}

function executor(
    conn, channel, feed_id, name, value, extra_props, resolve, reject) {
  assert(is_valid_feed_id(feed_id));
  assert(typeof name === 'string' && name);
  assert(name !== 'id');  // refuse setting this particular prop
  assert(is_valid_type_for_property(name, value));

  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, feed_id, name, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess =
      request_onsuccess.bind(request, feed_id, name, value, extra_props);
}

function txn_oncomplete(channel, feed_id, name, callback, event) {
  channel.postMessage({type: 'feed-written', id: feed_id, property: name});
  callback();
}

function request_onsuccess(feed_id, name, value, extra_props, event) {
  const feed = event.target.result;
  assert(feed);           // indicates bad id or unexpected state
  assert(is_feed(feed));  // corrupted state

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

function is_valid_type_for_property(name, value) {
  const value_type = typeof value;
  const active_value_types = ['boolean', 'undefined'];

  if (name === 'active' && !active_value_types.includes(value_type)) {
    return false;
  }

  return true;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
