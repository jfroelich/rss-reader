import {feed_is_valid_id} from '/src/objects/feed.js';

// TODO: deprecate in favor of find_feed_id_by_url

/*
TODO: actually instead of above, create rdr_find_feed_by_url, and add a
parameter to it, key_only, default false. If key_only is true, then this returns
a feed object with only an id property. If key_only is false, then this returns
a feed object with all properties. If no match is found, returns undefined. In
both cases an object is returned (which will change up how find_feed_id stuff
would be used). If this turns out as ergonomic then consider also applying this
approach to finding entries.
*/

export function rdr_contains_feed_with_url(conn, url) {
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
