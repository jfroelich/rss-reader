// TODO: test
// TODO: consider using title sort key in database instead of sorting in memory

// Asynchronously load an array of feeds from the database
// @param conn {IDBDatabase} an open db conn
// @param options {Object} optional, misc params
// @option mode {String} optional, either 'active' or anything else at the
// moment, if 'active' then only active feeds returned, note this may support
// other modes in the future I do not have a clear idea right now, trying to be
// flexible
// @option sort {Boolean} if true then returned array sorted by feed title
// normalized ascending
export function db_get_feeds(conn, options = {}) {
  return new Promise(executor.bind(null, conn, options));
}

function executor(conn, options, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onsuccess = request_onsuccess.bind(request, options, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(options, callback, event) {
  const feeds = event.target.result;
  if (options.sort) {
    feeds.sort(feed_compare);
  }

  if (options.mode === 'active') {
    callback(feeds.filter(is_active_feed));
  } else {
    callback(feeds);
  }
}

function is_active_feed(feed) {
  return feed.active;
}

function feed_compare(a, b) {
  const atitle = a.title ? a.title.toLowerCase() : '';
  const btitle = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(atitle, btitle);
}
