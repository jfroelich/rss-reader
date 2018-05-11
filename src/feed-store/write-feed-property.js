import {is_feed, is_valid_feed_id} from '/src/feed-store/feed.js';

// TODO: merge with write-feed. I am going for rest api. I want to simulate
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

export function write_feed_property(feed_id, name, value, extra_props = {}) {
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  if (typeof name !== 'string') {
    throw new TypeError('Invalid name: ' + name);
  }

  if (!name) {
    throw new TypeError('Invalid name: (empty-string)');
  }

  if (name === 'id') {
    throw new TypeError('Unwritable property ' + name);
  }

  if (!is_valid_type_for_property(name, value)) {
    throw new TypeError('Invalid value type for property ' + name);
  }

  return new Promise(executor.bind(this, feed_id, name, value, extra_props));
}

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
  this.channel.postMessage({type: 'feed-written', id: feed_id, property: name});
  callback();
}

function request_onsuccess(feed_id, name, value, extra_props, event) {
  const feed = event.target.result;
  if (!feed) {
    this.console.warn(
        '%s: feed not found %d', write_feed_property.name, feed_id);
    return;
  }

  if (!is_feed(feed)) {
    this.console.warn(
        '%s: bad object type %d %o', write_feed_property.name, feed_id, feed);
    return;
  }

  const run_date = new Date();

  if (name === 'active') {
    if (feed.active && value) {
      this.console.warn(
          '%s: tried to activate active feed (invalid state) %d',
          write_feed_property.name, feed_id);
      return;
    } else if (!feed.active && !value) {
      this.console.warn(
          '%s: tried to deactivate inactive feed (invalid state) %d',
          write_feed_property.name, feed_id);
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
