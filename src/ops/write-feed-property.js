import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';

// UNFINISHED

// TODO: tests
// TODO: create readme, move comments to readme or github
// TODO: in the readme explain the rationale behind the function's name because
// it is relatively unique and breaks from the naming convenition used thus far.
// moreover, consider revising names of other operations in the ops folder to
// use the read/write naming convention.

// TODO: think more about the error-like-but-not-really cases. Perhaps I am
// using the wrong abstraction. Perhaps this should be doing something like
// returning a value to distinguish between a successful update, a failed
// update, and a thrown error. There are really three cases but right now the
// caller can only know about two. I could also reconsider using a status code
// to represent categories of the outcome. I could do a mix of status and
// exception, where I throw errors in the programmer case, but never throw in
// the other cases. So maybe I was partially right earlier when pursuing a
// status-return-oriented design, and wrong to fully rollback to exceptions.
// Perhaps I want a compromise in the middle. However, the problem with that it
// is unconventional, I mean who does this. Perhaps I need to treat all error
// cases as actual errors, and throw even in the non-programmer-error cases,
// because basically Javascript forces code to work that way. Perhaps I could
// qualify that conclusion as less-awful because that is an acceptable
// characteristic of interpreted languages. Or maybe I should review go syntax.
// I just really dislike the current implementation because just logging is
// awkward.

// TODO: review the debate on whether to define a helper function for input
// variable validation.
// TODO: review the debate on whether to use an assert helper
// TODO: review the use of function.name as a parameter to log messages
// TODO: consider renaming feed_id_is_valid to is_valid_feed_id, I have
// inconsistent naming patterns and I think this may be one

// TODO: if I do depreate functions like activate-feed, maybe I want to
// additionally export pre-defined helper functions from this module, right
// here, that abstract away the boilerplate. One issue with that, is that
// currently the way I have setup the ops folder, it is one export per module. I
// would be breaking that convention. However I do kind of want to move in that
// direction. I don't know, mixed feelings. Another drawback is that the set of
// helpers exported would not be exhaustive, which might be counter-intuitive
// and give the appearance of an incomplete API, or lead to an unexpected
// result, a surprise, when one goes to use a helper just like the others and
// finds it does not exist.

export function write_feed_property(feed_id, name, value, extra_props = {}) {
  if (!this.console.log || !this.channel.postMessage ||
      !this.conn.transaction) {
    console.error('%s: called with invalid context', write_feed_property.name);
    throw new Error('Invalid context ' + JSON.stringify(this));
  }

  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  // TODO: maybe define a helper like is_valid_property_name that encapsulates
  // both these checks. They are tied together so they kind of belong to the
  // same abstraction, right? Tentative.

  // name must be a string
  if (typeof name !== 'string') {
    throw new TypeError('Invalid name type ' + name);
  }

  // name must be non-empty
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

  // Special case handling for the 'active' property
  if (name === 'active') {
    // Check state sanity
    // TODO: why? does it really matter?
    // TODO: are these error worthy?
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
        // Make sure it is not somehow set
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

  // This behavior depends on the entire operation in all cases but for the case
  // where the property being updated is the date itself
  if (name !== 'dateUpdated') {
    feed.dateUpdated = run_date;
  }

  // Start a put request. We let a put error bubble up to the txn, and we do
  // not listen for the success event because we can just listen for txn
  // completion
  const feed_object_store = event.target.source;
  feed_object_store.put(feed);
}
