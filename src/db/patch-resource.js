import Connection from '/src/db/connection.js';
import {NotFoundError} from '/src/db/errors.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function patch_resource(conn, props) {
  return new Promise(patch_resource_executor.bind(this, conn, props));
}

function patch_resource_executor(conn, props, resolve, reject) {
  assert(conn instanceof Connection);
  assert(conn.conn instanceof IDBDatabase);
  assert(props && typeof props === 'object');
  assert(resource_utils.is_valid_id(props.id));

  resource_utils.normalize(props);
  resource_utils.sanitize(props);
  resource_utils.validate(props);

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, props.id, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resources_store = transaction.objectStore('resources');
  const get_request = resources_store.get(props.id);
  get_request.onsuccess =
      get_request_onsuccess.bind(get_request, props, reject);
}

function transaction_oncomplete(id, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'resource-updated', id: id});
  }

  callback();
}

function get_request_onsuccess(props, reject, event) {
  const resource = event.target.result;

  // A note about exceptions versus rejection in this function. This function
  // occurs in a forked context. Throwing here will never settle the outer
  // promise. The exception will not be automatically translated into a
  // rejection. Instead, this function needs to be 100% exception free (to avoid
  // ever leaving the promise unsettled), and instead pass an error to the
  // reject callback and exit to simulate throwing an exception and mimic the
  // behavior of a typical rejection due to an exception.

  if (!resource) {
    const message = 'No resource found for id ' + props.id;
    reject(new NotFoundError(message));
    return;
  }

  // The next step of patching is validating the transitions specified by the
  // props parameter. Certain transitions are disallowed, but rather than error
  // we just noop for caller convenience. Essentially these transitions should
  // not have been specified and we just ignore them.

  // Treat an attempt to change a resource's read state to same state as a
  // partial noop. If this was the sole transition this might mean that we
  // do not write back later. Note this code is implemented for now as a side
  // effect (todo: easily remedy by cloning props).
  if (resource.read === props.read) {
    delete props.read;
    delete props.read_date;
  }

  if (props.archived === resource.archived) {
    delete props.archived;
    delete props.archived_date;
  }

  if (props.active === resource.active) {
    delete props.active;
    delete props.deactivation_date;
    delete props.deactivation_reason;
  }

  // Next, allow for incomplete specification of transitions by ensuring that
  // any functionally dependent property values are automatically updated as a
  // result of specifying other transitions. For example, if changing read
  // state, also set the read date.

  if (props.read === 1 && !props.read_date) {
    // Entering into read state should set date
    props.read_date = new Date();
  } else if (props.read === 0) {
    // Entering into unread state should unset date
    props.read_date = undefined;
  }

  if (props.archived === 1 && !props.archived_date) {
    props.archived_date = new Date();
  } else if (props.archived === 0) {
    props.archived_date = undefined;
  }

  if (props.active === 1) {
    delete props.deactivation_date;
    delete props.deactivation_reason;
  } else {
    if (!props.deactivation_date) {
      props.deactivation_date = new Date();
    }
  }

  // Next apply the transitions
  const immutable_prop_names = ['id', 'updated_date'];
  let dirtied_property_count = 0;

  for (const prop in props) {
    if (immutable_prop_names.includes(prop)) {
      continue;
    }

    const value = props[prop];
    if (value === undefined) {
      delete resource[prop];
    } else {
      resource[prop] = value;
    }
    dirtied_property_count++;
  }

  if (dirtied_property_count < 1) {
    // temp
    console.debug('No change to resource detected, not writing, id', props.id);
    return;
  }

  filter_empty_properties(resource);
  resource.updated_date = new Date();
  event.target.source.put(resource);
}
