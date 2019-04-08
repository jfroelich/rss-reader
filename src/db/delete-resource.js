import assert from '/src/assert.js';
import Connection from '/src/db/connection.js';
import * as resource_utils from '/src/db/resource-utils.js';

// TODO: support deleting enclosures?

// Deletes a resource and its immediate children. Note that grandchildren are
// completely ignored (e.g. after this, grand child resources now have a parent
// id property value that contains an outdated id value).
export default function delete_resource(conn, id, reason) {
  return new Promise(delete_resource_executor.bind(this, conn, id, reason));
}

function delete_resource_executor(conn, id, reason, resolve, reject) {
  assert(resource_utils.is_valid_id(id));

  const dependent_ids = [];

  const transaction = conn.conn.transaction('resources', 'readwrite');
  transaction.onerror = event => reject(event.target.error);
  transaction.oncomplete = transaction_oncomplete.bind(
      transaction, id, reason, dependent_ids, conn.channel, resolve);

  const resources_store = transaction.objectStore('resources');
  resources_store.delete(id);

  const cursor_request = resources_store.openCursor();
  cursor_request.onsuccess =
      cursor_request_onsuccess.bind(cursor_request, id, dependent_ids);
}

function cursor_request_onsuccess(id, dependent_ids, event) {
  const cursor = event.target.result;
  if (cursor) {
    const resource = cursor.value;
    if (resource.parent === id) {
      dependent_ids.push(resource.id);
      cursor.delete();
    }

    cursor.continue();
  }
}

function transaction_oncomplete(
    id, reason, dependent_ids, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'resource-deleted', id: id, reason: reason});

    for (const dep_id of dependent_ids) {
      channel.postMessage(
          {type: 'resource-deleted', id: dep_id, reason: reason, parent: id});
    }
  }

  callback(dependent_ids);
}
