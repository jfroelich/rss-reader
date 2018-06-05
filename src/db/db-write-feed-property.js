import {is_feed, is_valid_feed_id} from '/src/feed.js';

// TODO: stop using context parameters, revert to explicit parameters
// TODO: use rest-api or basic crud terminology, revert to using a name such as
// db_update_feed_property
// TODO: this potentially updates multiple properties, not just one, so the name
// of the function and module should reflect this, use a plural, something like
// db_update_feed_properties
// TODO: consider a stronger level of validation of incoming properties,
// possibly using some kind of a schema of known properties. Or make this less
// of a concern here, and more of a concern of some external validation.
// TODO: if the new value of a property being updated is undefined, this should
// delete the key, not just set the value to undefined. This reduces space used
// in storage. We are not doing anything like trying to maintain v8 shape. This
// provides a convenient mechanism for deleting properties. This is different
// than those properties not specified, those are left as is.
// TODO: differentiating between name/value and extra_props is, in hindsight,
// not exactly sensible. It would make more sense to have a props object
// containing all of the properties to modify. Which of those properties is
// primary reason for the update is not important here, what is important is
// decided by the caller and only in the caller context, but within the
// abstraction here, inside, we don't care.
// TODO: an issue with the contents of the messages sent to the channel, such as
// when activating a feed, in that if I only send out the property name, the
// message handler does not have enough information from reading the message to
// discern whether a feed became active or inactive, and can only tell that
// active-state changed. I am not sure if it is needed yet, but I think I need
// the handler to be able to more easily discern more about state changes.
// TODO: merge with db-write-feed. I am going for rest api. I want to simulate
// indexedDB's ability to modify a single property. So write feed will take
// a parameter like an array of property key-value pairs to update. The array
// will be optional. If no array, then the input feed overwrites. If array, then
// only the id of the feed is used, and the existing feed is loaded, the new
// properties are set, and then the modified existing feed is saved.
// OR, instead of this extra array param, I could have a 'merge-flag' parameter.
// If not set or false then existing feed overwritten blindly. If true, then
// existing feed is loaded, properties from new feed are taken and replaced in
// the existing feed, and then the existing feed is saved. So if the caller
// wants to update one property, then they just pass in a feed object with id,
// the property that should be changed, and it jsut works.
// TODO: what if I have a predicate parameter, like `mutator-function`, that
// allows the caller to specify the transition of properties that should occur,
// instead of localizing the logic for each of the property changes within the
// write function itself. This distributes the logic into each of the calling
// contexts. Maybe that makes more sense, albeit more complicated? This would
// leave the write function to just care about writing, which I kind of like as
// it feels like sep-concerns.
// TODO: implement tests

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
export function db_write_feed_property(feed_id, name, value, extra_props = {}) {
  return new Promise(executor.bind(this, feed_id, name, value, extra_props));
}

function executor(feed_id, name, value, extra_props, resolve, reject) {
  assert(is_valid_feed_id(feed_id));
  assert(typeof name === 'string' && name);
  assert(name !== 'id');  // refuse setting this particular prop
  assert(is_valid_type_for_property(name, value));

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed_id, name, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess =
      request_onsuccess.bind(this, feed_id, name, value, extra_props);
}

function txn_oncomplete(feed_id, name, callback, event) {
  this.channel.postMessage({type: 'feed-written', id: feed_id, property: name});
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
          '%s: tried to activate active feed (invalid state) %d',
          db_write_feed_property.name, feed_id);
      return;
    } else if (!feed.active && !value) {
      console.error(
          '%s: tried to deactivate inactive feed (invalid state) %d',
          db_write_feed_property.name, feed_id);
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

// TODO: maybe this should somehow borrow from some external schema definition
// that has per-property settings of type and allows-null(empty). I could also
// do a check above for whether the property exists in the schema in that case
// TODO: not currently exhaustive, may use switch statement
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
