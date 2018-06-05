// TODO: test
// TODO: consider using title sort key in database instead of sorting in memory

// Asynchronously load an array of feeds from the database
// @param conn {IDBDatabase} an open db conn
// @param mode {String} optional, either 'active' or anything else at the
// moment, if 'active' then only active feeds returned, note this may support
// other modes in the future I do not have a clear idea right now, trying to be
// flexible
// @param sort {Boolean} if true then returned array sorted by feed title, the
// title is first lowercased, sort is ascending order, alphanumeric, note that
// the sorting is done in memory after loading data from the database, this is
// suboptimal but simpler because it assumes that there is not a material
// performance gap
// @return {Promise} resolves to array of feeds
export function get_feeds(conn, mode = 'all', sort = false) {
  return new Promise(executor.bind(null, conn, mode, sort));
}

function executor(conn, mode, sort, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onsuccess = request_onsuccess.bind(request, mode, sort, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(mode, sort, callback, event) {
  const feeds = event.target.result;
  if (sort) {
    feeds.sort(feed_compare);
  }

  if (mode === 'active') {
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
