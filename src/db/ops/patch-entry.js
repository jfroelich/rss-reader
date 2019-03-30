import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import {InvalidStateError, NotFoundError} from '/src/db/errors.js';
import {is_valid_id} from '/src/db/identifiable.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import validate_entry from '/src/db/ops/validate-entry.js';
import {ENTRY_MAGIC} from '/src/db/types.js';
import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// TODO: implement patch-entry-test.js
// TODO: once this is implemented, revise set-entry-read-state to use this
// operation
// TODO: once this is implemented, I should also refactor update-feed, and
// change it into two operations: patch-feed and put-feed.

// Given a set of properties which must include id, find the corresponding entry
// in the database, properly adjust its properties to use the new values from
// the props parameter, then write it back. If fully replacing the entry it is
// better to use update-entry (soon to be renamed to put-entry).
export default function patch_entry(conn, props) {
  return new Promise(patch_entry_executor.bind(this, conn, props));
}

function patch_entry_executor(conn, props, resolve, reject) {
  assert(conn instanceof Connection);
  assert(conn.conn instanceof IDBDatabase);

  assert(props && typeof props === 'object');

  // id is required
  assert(is_valid_id(props.id));

  // Normalize properties
  // TODO: this is a hack to work around the sanity check in normalize-entry.
  // it would be better to just not have that sanity check
  props.magic = ENTRY_MAGIC;
  normalize_entry(props);

  // Sanitize the new field values upfront.
  // TODO: remove the is-entry check from sanitize-entry so that there is no
  // need to store magic in props and so sanitize-entry can run on a partial
  // object
  sanitize_entry(props);

  filter_empty_properties(props);

  // TODO: we can do this before loading so as to skip the load in the case
  // of invalid. however, this relies on the magic hack above. change
  // validate-entry to not do the is-entry sanity check and also to not assume
  // it is working with an actual entry object, just any kind of entry-like
  // object
  validate_entry(props);

  const transaction = conn.conn.transaction('entries', 'readwrite');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, props.id, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const entries_store = transaction.objectStore('entries');
  const get_request = entries_store.get(props.id);
  get_request.onsuccess = get_request_onsuccess.bind(get_request, props);
}

function transaction_oncomplete(id, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'entry-updated', id: id});
  }

  callback();
}

function get_request_onsuccess(props, event) {
  const entry = event.target.result;

  // If the entry is undefined then there was no corresponding entry in the
  // database. The caller attempted to patch an entry that does not exist.
  // Throw an error.
  if (!entry) {
    const message = 'No entry found for id ' + props.id;
    throw new NotFoundError(message);
  }

  if (!is_entry(entry)) {
    const message = 'Unable to patch non-entry object with id ' + props.id;
    throw new InvalidStateError(message);
  }

  // Validate transitions and throw an error if any transition is invalid
  // TODO: review for exhaustiveness
  // TODO: consider treating some of these as just no-ops instead of errors?
  // note that if i subscribe to the idea that patch is a set of transition
  // instructions and not just a bag of new values, then i could differentiate
  // between remarking as read intentionally and unintentionally, e.g.
  // an op could be 'set-if-not-equal', and another could be 'set'. if using
  // 'set' the caller does not care what the old state is. if using the other,
  // we could throw an error to indicate to the caller that it was equal.

  if (entry.read_state === Entry.READ && props.read_state === Entry.READ) {
    const message =
        'Cannot mark entry as read when already read for id ' + props.id;
    throw new InvalidStateError(message);
  }

  // Perform automatic implied transitions
  // TODO: what others are there? maybe the archive ones?

  // Marking an entry as read should set its read date if not specified
  if (props.read_state === Entry.READ && !props.read_date) {
    props.read_date = new Date();
  }

  // Apply the transitions

  for (const prop in props) {
    if (is_pseudo_immutable_prop(prop)) {
      continue;
    }

    const value = props[prop];
    if (value === undefined) {
      delete entry[prop];
    } else {
      entry[prop] = value;
    }
  }

  // Perform any implied mutations from using the patch operation. Note that
  // these override whatever the caller specified in props.
  entry.updated_date = new Date();

  const entry_store = event.target.source;
  entry_store.put(entry);
}

// Return whether the property name is a property whose value cannot be applied
// to an entry because the entry's existing value is treated as immutable
// (despite actually being mutable).
function is_pseudo_immutable_prop(prop_name) {
  const immutable_prop_names = ['id', 'updated_date'];
  return immutable_prop_names.includes(prop_name);
}
