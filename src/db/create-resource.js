import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// TODO: support new resource type "enclosure" that is child of type entry

export default function create_resource(conn, resource) {
  return new Promise(create_resource_executor.bind(this, conn, resource));
}

function create_resource_executor(conn, resource, resolve, reject) {
  assert(resource && typeof resource === 'object');
  assert(resource.id === undefined);
  assert(resource.type === 'feed' || resource.type === 'entry');

  // The model requires that that all feeds have a location, but entries are not
  // required to have a url
  assert(resource.type === 'entry' || resource_utils.has_url(resource));

  // Feeds are by default active when created unless explicitly inactive
  if (resource.type === 'feed' && resource.active === undefined) {
    resource.active = 1;
  }

  if (resource.type === 'entry' && resource.read === undefined) {
    resource.read = 0;
  }

  if (resource.type === 'entry' && resource.archived === undefined) {
    resource.archived = 0;
  }

  resource.created_date = new Date();
  resource.updated_date = undefined;

  resource_utils.normalize(resource);
  resource_utils.sanitize(resource);
  resource_utils.validate(resource);
  filter_empty_properties(resource);

  console.debug('Creating resource', resource);

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resources_store = transaction.objectStore('resources');
  const put_request = resources_store.put(resource);
  put_request.onsuccess = event => resource.id = put_request.result;
}

function transaction_oncomplete(resource, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'resource-created', id: resource.id});
  }
  callback(resource.id);
}
