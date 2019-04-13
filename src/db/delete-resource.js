import assert from '/lib/assert.js';
import * as resourceUtils from '/src/db/resource-utils.js';

// TODO: support deleting enclosures?

// Deletes a resource and its immediate children. Note that grandchildren are
// completely ignored (e.g. after this, grand child resources now have a parent
// id property value that contains an outdated id value).
export default function deleteResource(conn, id, reason) {
  return new Promise(deleteResourceExecutor.bind(this, conn, id, reason));
}

function deleteResourceExecutor(conn, id, reason, resolve, reject) {
  assert(resourceUtils.isValidId(id));

  const dependentIds = [];

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.onerror = event => reject(event.target.error);
  transaction.oncomplete = transactionOncomplete.bind(transaction, id, reason, dependentIds,
    conn.channel, resolve);

  const resourcesStore = transaction.objectStore('resources');
  resourcesStore.delete(id);

  const cursorRequest = resourcesStore.openCursor();
  cursorRequest.onsuccess = cursorRequestOnsuccess.bind(cursorRequest, id, dependentIds);
}

function cursorRequestOnsuccess(id, dependentIds, event) {
  const cursor = event.target.result;
  if (cursor) {
    const resource = cursor.value;
    if (resource.parent === id) {
      dependentIds.push(resource.id);
      cursor.delete();
    }

    cursor.continue();
  }
}

function transactionOncomplete(id, reason, dependentIds, channel, callback) {
  if (channel) {
    channel.postMessage({ type: 'resource-deleted', id, reason });

    for (const dependentId of dependentIds) {
      channel.postMessage({
        type: 'resource-deleted', id: dependentId, reason, parent: id
      });
    }
  }

  callback(dependentIds);
}
