export function get_feeds(conn, mode = 'all', sort = false) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onerror = _ => reject(request.error);
    request.onsuccess = _ => {
      const feeds = request.result;
      if (sort) {
        feeds.sort(compare_feeds);
      }

      if (mode === 'active') {
        resolve(feeds.filter(feed => feed.active));
      } else {
        resolve(feeds);
      }
    };
  });
}

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}
