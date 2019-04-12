import assert from '/lib/assert.js';

export default function countResources(query) {
  return new Promise((resolve, reject) => {
    assert(query && typeof query === 'object');

    // for now we only support counting unread entries
    assert(query.read === 0);
    assert(query.type === 'entry');

    const transaction = query.conn.conn.transaction('resources');
    const resourcesStore = transaction.objectStore('resources');
    const typeReadIndex = resourcesStore.index('type-read');
    const request = typeReadIndex.count(['entry', 0]);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
