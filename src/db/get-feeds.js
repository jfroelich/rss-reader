// TOOD: refactor title sorting. Originally I had a title index in the database,
// and loaded the feeds in sorted order. That caused a big problem, because
// indexedDB does not index missing values, so the result excluded untitled
// feeds. So now I sort in memory after load. However, I'd still like to think
// about how to do this more quickly. One idea is that I store a sort-key
// property per feed in the feed store. I guarantee the property always has a
// value when storing a feed, even an empty string works to defeat the index
// problem. Each time the feed is updated, and when the feed is created, the
// property is derived from title, and it also normalizes the title (e.g.
// toLowerCase). Then I can create an index on that property, and let indexedDB
// do the sorting implicitly, and quickly, and more efficiently. At the moment,
// this isn't urgent.

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
