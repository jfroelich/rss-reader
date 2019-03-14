export default function get_feeds(conn, mode = 'all', title_sort) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onerror = event => reject(event.target.error);
    request.onsuccess = _ => {
      let feeds = request.result;

      if (mode === 'active') {
        feeds = feeds.filter(feed => feed.active);
      }

      if (title_sort) {
        feeds.sort(function(a, b) {
          const s1 = a.title ? a.title.toLowerCase() : '';
          const s2 = b.title ? b.title.toLowerCase() : '';
          return indexedDB.cmp(s1, s2);
        });
      }

      resolve(feeds);
    };
  });
}
