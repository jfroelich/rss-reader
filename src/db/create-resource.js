import * as resourceUtils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filterEmptyProperties from '/src/lib/filter-empty-properties.js';

// TODO: support new resource type "enclosure" that is child of type entry

// Store a new object in the database and get its key path. Returns a promise that resolves to the
// new, automatically-generated unique id of the resource.
//
// Throws various errors such as when passed invalid input, or when there was problem communicating
// with the database.
export default function createResource(conn, resource) {
  return new Promise(executor.bind(null, conn, resource));
}

function executor(conn, resource, resolve, reject) {
  assert(resource && typeof resource === 'object');
  assert(resource.id === undefined);
  assert(resource.type === 'feed' || resource.type === 'entry');

  // Feed resources must have at least one url.
  if (resource.type === 'feed') {
    assert(resource.urls && resource.urls.length);
  }

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

  resourceUtils.normalize(resource);
  resourceUtils.sanitize(resource);
  resourceUtils.validate(resource);
  filterEmptyProperties(resource);

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.oncomplete = transactionOncomplete.bind(transaction, resource, conn.channel, resolve);
  transaction.onerror = event => reject(event.target.error);

  const resourcesStore = transaction.objectStore('resources');
  const putRequest = resourcesStore.put(resource);
  putRequest.onsuccess = () => {
    resource.id = putRequest.result;
  };
}

function transactionOncomplete(resource, channel, callback) {
  if (channel) {
    channel.postMessage({
      type: 'resource-created',
      id: resource.id,
      resourceType: resource.type
    });
  }

  callback(resource.id);
}
