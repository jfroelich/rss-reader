export async function get_feeds(conn, mode = 'all', sort = false) {
  let feeds = await get_feeds_internal(conn);

  if (mode === 'active') {
    feeds = feeds.filter(feed => feed.active);
  }

  if (sort) {
    feeds.sort(compare_feeds);
  }

  return feeds;
}

function get_feeds_internal(conn) {
  return new Promise(get_feeds_executor.bind(null, conn));
}

function get_feeds_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => reject(request.error);
  request.onsuccess = _ => resolve(request.result);
}

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}
