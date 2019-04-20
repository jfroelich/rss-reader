import * as resourceUtils from '/src/db/resource-utils.js';
import Connection from '/src/db/connection.js';
import assert from '/src/lib/assert.js';
import filterEmptyProperties from '/src/lib/filter-empty-properties.js';

export default function putResource(conn, resource) {
  return new Promise(executor.bind(this, conn, resource));
}

function executor(conn, resource, resolve, reject) {
  assert(conn instanceof Connection);
  assert(resource && typeof resource === 'object');
  assert(resourceUtils.isValidId(resource.id));
  assert(resource.type === 'feed' || resource.type === 'entry');
  assert(resource.type === 'entry' || (resource.urls && resource.urls.length));
  assert(resource.type === 'feed' || resourceUtils.isValidId(resource.parent));

  resourceUtils.normalize(resource);
  resourceUtils.sanitize(resource);
  resourceUtils.validate(resource);
  filterEmptyProperties(resource);
  resource.updated_date = new Date();

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete = transactionOncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);
  transaction.objectStore('resources').put(resource);
}

function transactionOncomplete(resource, channel, callback) {
  if (channel) {
    channel.postMessage({
      type: 'resource-updated',
      id: resource.id,
      resourceType: resource.type
    });
  }
  callback(resource);
}
