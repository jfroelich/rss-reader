export function get_feeds(conn, title_sort_flag = false) {
  return new Promise(executor.bind(null, conn, title_sort_flag));
}

function executor(conn, title_sort_flag, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onsuccess = request_onsuccess.bind(request, title_sort_flag, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(title_sort_flag, callback, event) {
  const feeds = event.target.result;
  if (title_sort_flag) {
    feeds.sort(feed_compare);
  }

  callback(feeds);
}

function feed_compare(a, b) {
  const atitle = a.title ? a.title.toLowerCase() : '';
  const btitle = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(atitle, btitle);
}
