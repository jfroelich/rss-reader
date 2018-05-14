import {create_feed, is_valid_feed_id} from '/src/feed.js';

export function db_find_feed_by_url(conn, url, key_only = false) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL: ' + url);
  }

  return new Promise(executor.bind(null, conn, url, key_only));
}

function executor(conn, url, key_only, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const index = store.index('urls');

  // Either load only the key, or the full object, by using different query
  // tools. indexedDB cannot load limited properties unfortunately.
  const href = url.href;
  const request = key_only ? index.getKey(href) : index.get(href);

  request.onsuccess = request_onsuccess.bind(request, key_only, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(key_only, callback, event) {
  let feed;
  if (key_only) {
    const feed_id = event.target.result;

    // The fact that the request was successful does not mean we matched
    // anything. The result of index.getKey is the key value, so use the id
    // validation to check it is defined. That is stricter than simple defined
    // test, for a bit of overhead, but reduces the user-modified-data-directly
    // exposure, which is kinda something I want to pay more attn to, albeit
    // perhaps too paranoid.

    if (is_valid_feed_id(feed_id)) {
      // Mimic a matched feed object, as if we magically loaded a feed with
      // only one property. This way the optimization of using getKey is opaque
      // to the caller. We construct using the feed.js api to ensure the magic
      // property is set implicitly.
      // We do not bother with appending the url. That is something we could do
      // but I do not currently see the use case.
      feed = create_feed();
      feed.id = feed_id;
    } else {
      // Fall through, leaving feed undefined
    }

  } else {
    // Get the full feed object from the result of index.get
    // This may be undefined
    feed = event.target.result;
  }

  callback(feed);
}
