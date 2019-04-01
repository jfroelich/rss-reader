import Connection from '/src/db/connection.js';
import {InvalidStateError, NotFoundError} from '/src/db/errors.js';
import is_valid_id from '/src/db/is-valid-id.js';
import sanitize_feed from '/src/db/ops/sanitize-feed.js';
import validate_feed from '/src/db/ops/validate-feed.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// Update some of the properties of an existing feed
export default function patch_feed(conn, props) {
  return new Promise(patch_feed_executor.bind(this, conn, props));
}

function patch_feed_executor(conn, props, resolve, reject) {
  assert(conn instanceof Connection);
  assert(typeof props === 'object');
  assert(is_valid_id(props.id));

  resource_utils.normalize_resource(props);
  sanitize_feed(props);
  validate_feed(props);
  filter_empty_properties(props);

  // TODO: move this to after feed loaded from db so as to better treat props
  // as immutable
  props.updated_date = new Date();

  const transaction = conn.conn.transaction('feeds', 'readwrite');
  transaction.onerror = event => reject(event.target.error);
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, props.id, conn.channel, resolve);

  const store = transaction.objectStore('feeds');

  const get_request = store.get(props.id);
  get_request.onsuccess =
      get_request_onsuccess.bind(get_request, props, reject);
}

function get_request_onsuccess(props, reject, event) {
  const feed = event.target.result;

  // TODO: learn more about why this has to reject. it is unclear. if i throw
  // here instead of reject, in this delayed setting, the promise never
  // resolves, because the thrown exception is never translated into a rejection
  // ideally i should just throw. this also causes concern about any other kind
  // of error that could happen.

  if (!feed) {
    const message = 'Failed to find feed to patch for id ' + props.id;
    reject(new NotFoundError(message));
    return;
  }

  // Prevalidate the transitions

  if (props.active === true && feed.active === true) {
    const message = 'Cannot activate already active feed with id ' + props.id;
    reject(new InvalidStateError(message));
    return;
  }

  if (props.active === false && feed.active === false) {
    const message = 'Cannot deactivate inactive feed with id ' + feed.id;
    reject(new InvalidStateError(message));
    return;
  }

  // Do functionally dependent transitions
  if (props.active === true) {
    props.deactivation_reason = undefined;
    props.deactivation_date = undefined;
  }

  if (props.active === false) {
    props.deactivation_date = new Date();
  }

  // Do the transitions
  for (const prop in props) {
    // Treat id as immutable.
    if (prop === 'id' || prop === 'updated_date') {
      continue;
    }

    const value = props[prop];
    if (value === undefined) {
      delete feed[prop];
    } else {
      feed[prop] = value;
    }
  }

  feed.updated_date = new Date();
  event.target.source.put(feed);
}

function transaction_oncomplete(id, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'feed-updated', id: id});
  }

  callback();
}
