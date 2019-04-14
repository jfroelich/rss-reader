import * as resourceUtils from '/src/db/resource-utils.js';
import Connection from '/src/db/connection.js';
import assert from '/lib/assert.js';

export default function getResource(query) {
  return new Promise(getResourceExecutor.bind(this, query));
}

function getResourceExecutor(query, resolve, reject) {
  assert(query.conn instanceof Connection);
  assert(query.mode === 'id' || query.mode === 'url');

  if (query.mode === 'id') {
    assert(resourceUtils.isValidId(query.id));
    assert(!query.keyOnly);
  } else if (query.mode === 'url') {
    assert(query.url instanceof URL);
  }

  const transaction = query.conn.conn.transaction('resources');
  transaction.onerror = event => reject(event.target.error);

  const resourcesStore = transaction.objectStore('resources');
  let request;
  if (query.mode === 'url') {
    const index = resourcesStore.index('urls');
    const { href } = query.url;
    request = query.keyOnly ? index.getKey(href) : index.get(href);
  } else if (query.mode === 'id') {
    request = resourcesStore.get(query.id);
  }

  request.onsuccess = requestOnsuccess.bind(request, query, resolve);
}

function requestOnsuccess(query, callback, event) {
  const { result } = event.target;

  if (typeof result !== 'undefined') {
    if (query.keyOnly) {
      // key only match
      callback({ id: result });
    } else {
      // full match
      callback(result);
    }
  } else {
    // no match
    callback();
  }
}
