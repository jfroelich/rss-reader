import assert from '/lib/assert.js';
import filterEmptyProperties from '/lib/filter-empty-properties.js';
import Connection from '/src/db/connection.js';
import * as resourceUtils from '/src/db/resource-utils.js';

export default function putResource(conn, resource) {
  return new Promise(putResourceExecutor.bind(this, conn, resource));
}

function putResourceExecutor(conn, resource, resolve, reject) {
  assert(conn instanceof Connection);
  assert(resource && typeof resource === 'object');
  assert(resourceUtils.isValidId(resource.id));
  assert(resource.type === 'feed' || resource.type === 'entry');
  assert(resource.type === 'entry' || resourceUtils.hasURL(resource));
  assert(resource.type === 'feed' || resourceUtils.isValidId(resource.parent));

  resourceUtils.normalize(resource);
  resourceUtils.sanitize(resource);
  resourceUtils.validate(resource);
  filterEmptyProperties(resource);
  resource.updated_date = new Date();

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete = transactionOncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resourcesStore = transaction.objectStore('resources');
  resourcesStore.put(resource);
}

function transactionOncomplete(resource, channel, callback) {
  if (channel) {
    channel.postMessage({ type: 'resource-updated', id: resource.id });
  }
  callback(resource);
}
