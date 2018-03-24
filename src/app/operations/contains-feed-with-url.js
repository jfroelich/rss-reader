import {feed_is_valid_id} from '/src/app/objects/feed.js';

export function contains_feed_with_url(conn, url) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL: ' + url);
  }

  return new Promise(executor.bind(null, conn, url));
}

function executor(conn, url, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const index = store.index('urls');
  const request = index.getKey(url.href);
  request.onsuccess = request_onsuccess.bind(request, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(callback, event) {
  const feed_id = event.target.result;
  callback(feed_is_valid_id(feed_id));
}
