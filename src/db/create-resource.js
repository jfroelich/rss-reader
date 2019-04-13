import assert from '/lib/assert.js';
import filterEmptyProperties from '/lib/filter-empty-properties.js';
import * as resourceUtils from '/src/db/resource-utils.js';

// TODO: support new resource type "enclosure" that is child of type entry

export default function createResource(conn, resource) {
  return new Promise(createResourceExecutor.bind(null, conn, resource));
}

function createResourceExecutor(conn, resource, resolve, reject) {
  assert(resource && typeof resource === 'object');
  assert(resource.id === undefined);
  assert(resource.type === 'feed' || resource.type === 'entry');

  // The model requires that that all feeds have a location, but entries are not
  // required to have a url
  assert(resource.type === 'entry' || resourceUtils.hasURL(resource));

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

  console.debug('Creating resource', resource);

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
    channel.postMessage({ type: 'resource-created', id: resource.id });
  }
  callback(resource.id);
}
