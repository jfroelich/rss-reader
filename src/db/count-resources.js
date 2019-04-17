import assert from '/src/lib/assert.js';

export default function countResources(conn, query) {
  return new Promise((resolve, reject) => {
    // Currently this only supports counting unread entries
    assert(query.read === 0);
    assert(query.type === 'entry');

    const transaction = conn.conn.transaction('resources');
    const resourcesStore = transaction.objectStore('resources');
    const typeReadIndex = resourcesStore.index('type-read');
    const request = typeReadIndex.count(['entry', 0]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
