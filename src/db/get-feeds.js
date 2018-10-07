export async function get_feeds(session, mode = 'all', title_sort) {
  let feeds = await new Promise(get_feeds_executor.bind(null, session.conn));

  if (mode === 'active') {
    feeds = feeds.filter(feed => feed.active);
  }

  if (title_sort) {
    feeds.sort(feed_title_comparator);
  }

  return feeds;
}

function get_feeds_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => reject(request.error);
  request.onsuccess = _ => resolve(request.result);
}

function feed_title_comparator(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}
