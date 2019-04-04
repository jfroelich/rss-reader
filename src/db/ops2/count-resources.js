import assert from '/src/lib/assert.js';

export default function count_resources(query) {
  return new Promise((resolve, reject) => {
    assert(query && typeof query === 'object');

    // for now we only support counting unread entries
    assert(query.read === 0);
    assert(query.type === 'entry');

    const transaction = query.conn.conn.transaction('resources');
    const resources_store = transaction.objectStore('resources');
    const type_read_index = resources_store.index('type-read');
    const request = type_read_index.count(['entry', 0]);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
