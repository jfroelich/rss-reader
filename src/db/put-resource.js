import Connection from '/src/db/connection.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function put_resource(conn, resource) {
  return new Promise(put_resource_executor.bind(this, conn, resource));
}

function put_resource_executor(conn, resource, resolve, reject) {
  assert(conn instanceof Connection);
  assert(resource && typeof resource === 'object');
  assert(resource_utils.is_valid_id(resource.id));
  assert(resource.type === 'feed' || resource.type === 'entry');
  assert(resource.type === 'entry' || resource_utils.has_url(resource));
  assert(
      resource.type === 'feed' || resource_utils.is_valid_id(resource.parent));

  resource_utils.normalize(resource);
  resource_utils.sanitize(resource);
  resource_utils.validate(resource);
  filter_empty_properties(resource);
  resource.updated_date = new Date();

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resources_store = transaction.objectStore('resources');
  resources_store.put(resource);
}

function transaction_oncomplete(resource, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'resource-updated', id: resource.id});
  }
  callback(resource);
}
