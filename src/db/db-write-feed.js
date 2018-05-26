import {create_feed, is_feed, is_valid_feed_id} from '/src/feed.js';
import {truncate_html} from '/src/lib/html/truncate-html.js';
import {replace_tags} from '/src/lib/html/replace-tags.js';
import {list_peek} from '/src/lib/lang/list.js';
import {filter_empty_properties} from '/src/lib/lang/object.js';
import {condense_whitespace, filter_control_characters} from '/src/lib/lang/string.js';

// TODO: create modules for sanitize and validate, require caller to explicitly
// call those functions as additional optional boilerplate, and then deprecate
// the options.sanitize and options.validate arguments here. Also do a similar
// pattern for entries. Having separate sanitize and validate functions fits
// better with the one-function-per-file method of organization, is more
// readily testable, less opaque, and is a better use of parameters. See also
// note about this in the db-write-entry doc (or maybe it is db-write-feed).

// TODO: if caller must sanitize, then no longer need to return object, just
// return id

// Creates or updates the given feed in storage
export function db_write_feed(feed, options = {}) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter type ' + feed);
  }

  const is_update = 'id' in feed;
  const prefix = is_update ? 'updating' : 'creating';
  this.console.debug(
      '%s: %s feed', db_write_feed.name, prefix, list_peek(feed.urls));

  // TODO: if we are always going to clone and this is sole caller of
  // sanitize_feed just do the clone here in both cases and do not clone in
  // sanitize_feed. Unless I make sanitize-feed its own public method again
  let clone;
  if (options.sanitize) {
    clone = filter_empty_properties(sanitize_feed(feed, options));
  } else {
    clone = Object.assign(create_feed(), feed);
  }

  return new Promise(executor.bind(this, is_update, clone, options));
}

function executor(is_update, feed, options, resolve, reject) {
  if (options.validate && !is_valid_feed(feed)) {
    const error = new Error('Invalid feed ' + JSON.stringify(feed));
    reject(error);
    return;
  }

  // is-valid-feed just checks feed.urls type, but all stored feeds must
  // have at least one url.
  // TODO: add a check that feed.urls is not empty


  if (is_update) {
    if (options.set_date_updated) {
      feed.dateUpdated = new Date();
    }
  } else {
    feed.active = true;
    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, is_update, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);

  if (!is_update) {
    request.onsuccess = _ => feed.id = request.result;
  }
}

function txn_oncomplete(is_update, feed, callback, event) {
  const message = {type: 'feed-written', id: feed.id, create: !is_update};
  this.console.debug('%s: %o', db_write_feed.name, message);
  this.channel.postMessage(message);
  callback(feed);
}

// TODO: finish all checks
function is_valid_feed(feed) {
  if ('id' in feed && !is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  if ('urls' in feed && !Array.isArray(feed.urls)) {
    return false;
  }

  return true;
}

function sanitize_feed(feed, options) {
  let title_max_length = options.title_max_length,
      description_max_length = options.description_max_length;

  if (typeof title_max_length === 'undefined') {
    title_max_length = 1024;
  }

  if (typeof description_max_length === 'undefined') {
    description_max_length = 1024 * 10;
  }

  const blank_feed = create_feed();
  const output_feed = Object.assign(blank_feed, feed);
  const html_tag_replacement = '';
  const suffix = '';

  if (output_feed.title) {
    let title = output_feed.title;
    title = filter_control_characters(title);
    title = replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = filter_control_characters(desc);
    desc = replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

/*
# db-write-feed
The `db_write_feed` operation creates or updates a feed in the database, and
broadcasts a *feed-written* type message to the channel when finished. Other
than the situation where an options flag is true, this inserts the feed object
*as-is*. The input feed object is never modified.

### Context properties
* **conn** {IDBDatabase} an open database connection
* **channel** {BroadcastChannel} a channel to send messages about a feed being
created or updated
* **console** {object} logging destination, any console-like object
All properties are required.

### Params
* **feed** {object} the feed object to store, required, must have the magic type
property
* **options** {object} optional, the set of options to specialize the call, see
the next section

### Options
* **validate** {Boolean} defaults to false, if true then feed's properties are
validated, and the returned promise rejects if the feed is invalid
* **sanitize** {Boolean} defaults to false, if true then the feed is sanitized
prior to storage
* **set_date_updated** {Boolean} defaults to false, if true then the feed's
`dateUpdated` property is set to the time this function is called

### Return value
`db_write_feed` is an asynchronous function that returns a promise. The promise
return value is the stored feed object.

### Errors
* **TypeError** feed is not a feed type, unlike the other errors this is thrown
immediately and not as a promise rejection because making this mistake
constitutes a permanent programmer error
* **InvalidStateError** closed channel when calling postMessage, note that
internally that channel.postMessage is called *after* the transaction has
settled successfully, because it is important to not send out channel messages
prematurely in case of transactional failure, meaning that even when this error
is thrown the database was still updated, which means that the caller should not
necessarily consider this an error, also note that any database error that
causes a transactional error means that this will not even attempt to send a
message so in other words a database error precludes any channel errors
* **Error** a general error that is thrown when the validate option is true and
the input feed is invalid, note that sanitization takes place *before*
validation
* **DOMException** database interaction error (notably this is not a DOMError as
that was deprecated by whatwg/w3c), will happen with things like a constraint
error occurs (such as the one on the urls index), or some kind of strange
transactional error, no-space error, database is closed or pending close error

### Implementation note on functional purity
This is a mostly-pure function. Of course it is impure in that the database is
permanently modified as a side effect, and a channel message is broadcast. It is
pure in the sense that the context and input parameters are never modified.

### Implementation note on setting new id
The result of using `IDBObjectStore.prototype.put` is the keypath of the
inserted object, so here it is always the new feed object's id, regardless of
whether the feed is being created or overwritten.

### TODOs
* I am not sure this should reject in the case of attempting to update a feed
with invalid properties. Rejections should only occur generally in the case of
programmer errors or other serious errors such as a database i/o error, but
using invalid data is obviously not a programmer error. What should happen when
the feed has invalid properties? For now I am rejecting the promise, but that
doesn't sit well with me. I feel like javascript and promises are unfairly
hoisting an error pattern on me.
* What if purity isn't worth it and I should just modify the input object in
place? On the other hand what is the difference in performance? Maybe this is
nitpicking and not worth effort.
* write tests
* maybe validate/sanitize/set-date-updated options are dumb

*/
