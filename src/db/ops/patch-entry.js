import Connection from '/src/db/connection.js';
import {InvalidStateError, NotFoundError} from '/src/db/errors.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

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
  assert(resource_utils.is_valid_id(props.id));

  resource_utils.normalize(props);
  resource_utils.sanitize(props);
  resource_utils.validate(props);

  const transaction = conn.conn.transaction('entries', 'readwrite');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, props.id, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const entries_store = transaction.objectStore('entries');
  const get_request = entries_store.get(props.id);
  get_request.onsuccess =
      get_request_onsuccess.bind(get_request, props, reject);
}

function transaction_oncomplete(id, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'entry-updated', id: id});
  }

  callback();
}

function get_request_onsuccess(props, reject, event) {
  const entry = event.target.result;

  // If the entry is undefined then there was no corresponding entry in the
  // database. The caller attempted to patch an entry that does not exist.
  // Throw an error.
  if (!entry) {
    const message = 'No entry found for id ' + props.id;
    reject(new NotFoundError(message));
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

  if (entry.read_state === 1 && props.read_state === 1) {
    const message =
        'Cannot mark entry as read when already read for id ' + props.id;
    reject(new InvalidStateError(message));
  }

  // Perform automatic implied transitions
  // TODO: what others are there? maybe the archive ones?

  // Marking an entry as read should set its read date if not specified
  if (props.read_state === 1 && !props.read_date) {
    props.read_date = new Date();
  }

  // Marking an entry as unread should delete its read date
  if (props.read_state === 0) {
    props.read_date = undefined;
  }

  // Changing an entry into the archive state should set date if not set
  if (props.archive_state === 1 && !props.archived_date &&
      !entry.archived_date) {
    props.archived_date = new Date();
  }

  // Apply the transitions
  const immutable_prop_names = ['id', 'updated_date'];

  for (const prop in props) {
    if (immutable_prop_names.includes(prop)) {
      continue;
    }

    const value = props[prop];
    if (value === undefined) {
      delete entry[prop];
    } else {
      entry[prop] = value;
    }
  }

  // Note: this must not happen prior to iterating props or it will delete all
  // the nullify transitions.
  filter_empty_properties(entry);

  // Perform any implied transitions from using the patch operation. These
  // override caller props.
  entry.updated_date = new Date();

  event.target.source.put(entry);
}
