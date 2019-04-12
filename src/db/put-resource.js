import assert from '/lib/assert.js';
import filterEmptyProperties from '/lib/filter-empty-properties.js';
import Connection from '/src/db/connection.js';
import * as resourceUtils from '/src/db/resource-utils.js';

export default function putResource(conn, resource) {
  return new Promise(put_resource_executor.bind(this, conn, resource));
}

function put_resource_executor(conn, resource, resolve, reject) {
  assert(conn instanceof Connection);
  assert(resource && typeof resource === 'object');
  assert(resourceUtils.isValidId(resource.id));
  assert(resource.type === 'feed' || resource.type === 'entry');
  assert(resource.type === 'entry' || resourceUtils.hasURL(resource));
  assert(
    resource.type === 'feed' || resourceUtils.isValidId(resource.parent),
  );

  resourceUtils.normalize(resource);
  resourceUtils.sanitize(resource);
  resourceUtils.validate(resource);
  filterEmptyProperties(resource);
  resource.updated_date = new Date();

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete = transaction_oncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resources_store = transaction.objectStore('resources');
  resources_store.put(resource);
}

function transaction_oncomplete(resource, channel, callback, event) {
  if (channel) {
    channel.postMessage({ type: 'resource-updated', id: resource.id });
  }
  callback(resource);
}
