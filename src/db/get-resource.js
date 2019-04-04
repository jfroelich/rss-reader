import Connection from '/src/db/connection.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';

export default function get_resource(query) {
  return new Promise(get_resource_executor.bind(this, query));
}

function get_resource_executor(query, resolve, reject) {
  assert(query.conn instanceof Connection);
  assert(query.mode === 'id' || query.mode === 'url');

  if (query.mode === 'id') {
    assert(resource_utils.is_valid_id(query.id));
    assert(!query.key_only);
  } else if (query.mode === 'url') {
    assert(query.url instanceof URL);
  }

  const transaction = query.conn.conn.transaction('resources');
  transaction.onerror = event => reject(event.target.error);

  const resources_store = transaction.objectStore('resources');
  let request;
  if (query.mode === 'url') {
    const index = resources_store.index('urls');
    const href = query.url.href;
    request = query.key_only ? index.getKey(href) : index.get(href);
  } else if (query.mode === 'id') {
    request = resources_store.get(query.id);
  }

  request.onsuccess = request_onsuccess.bind(request, query, resolve);
}

function request_onsuccess(query, callback, event) {
  const result = event.target.result;

  if (typeof result !== 'undefined') {
    if (query.key_only) {
      // key only match
      callback({id: event.target.result});
    } else {
      // full match
      callback(event.target.result);
    }
  } else {
    // no match
    callback();
  }
}
