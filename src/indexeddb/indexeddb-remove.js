// Remove an indexedDB database from the browser (for this origin)
export function indexeddb_remove(name) {
  return new Promise((resolve, reject) => {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = _ => {
      console.debug('Deleted database', name);
      resolve();
    };
    request.onerror = _ => reject(request.error);
  });
}
