import assert from '/lib/assert.js';
import filterEmptyProperties from '/lib/filter-empty-properties.js';
import Connection from '/src/db/connection.js';
import { NotFoundError } from '/src/db/errors.js';
import * as resourceUtils from '/src/db/resource-utils.js';

export default function patchResource(conn, props) {
  return new Promise(patchResourceExecutor.bind(this, conn, props));
}

function patchResourceExecutor(conn, props, resolve, reject) {
  assert(conn instanceof Connection);
  assert(conn.conn instanceof IDBDatabase);
  assert(props && typeof props === 'object');
  assert(resourceUtils.isValidId(props.id));

  resourceUtils.normalize(props);
  resourceUtils.sanitize(props);
  resourceUtils.validate(props);

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete = transactionOncomplete.bind(transaction, props.id, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resourcesStore = transaction.objectStore('resources');
  const getRequest = resourcesStore.get(props.id);
  getRequest.onsuccess = getRequestOnsuccess.bind(getRequest, props, reject);
}

function transactionOncomplete(id, channel, callback) {
  if (channel) {
    channel.postMessage({ type: 'resource-updated', id });
  }

  callback();
}

function getRequestOnsuccess(props, reject, event) {
  const resource = event.target.result;

  // NOTE: throwing would be an uncaught exception
  if (!resource) {
    const message = `No resource found for id ${props.id}`;
    reject(new NotFoundError(message));
    return;
  }

  // Transform props producing noop transitions
  if (props.read === resource.read) {
    delete props.read;
  }

  if (props.archived === resource.archived) {
    delete props.archived;
  }

  if (props.active === resource.active) {
    delete props.active;
  }

  // Impute missing derived properties
  if (props.read === 1 && !props.read_date) {
    props.read_date = new Date();
  } else if (props.read === 0) {
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
  } else if (!props.deactivation_date) {
    props.deactivation_date = new Date();
  }

  // Apply transitions
  const immutablePropertyNames = ['id', 'updated_date'];
  let dirtiedPropertyCount = 0;

  for (const prop in props) {
    if (immutablePropertyNames.includes(prop)) {
      continue;
    }

    const value = props[prop];
    if (value === undefined) {
      delete resource[prop];
    } else {
      resource[prop] = value;
    }
    dirtiedPropertyCount += 1;
  }

  if (dirtiedPropertyCount) {
    filterEmptyProperties(resource);
    resource.updated_date = new Date();
    event.target.source.put(resource);
  }
}
