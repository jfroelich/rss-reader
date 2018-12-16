import assert from '/src/assert.js';
import * as object from '/src/lang-utils/object-utils.js';
import * as types from './types.js';

// Create several feeds using a single transaction. This is preferable to
// calling create_feed in a loop as that involves many transactions.
export async function create_feeds(session, feeds) {
  // Do some basic input validation and sanitization
  for (const feed of feeds) {
    assert(types.is_feed(feed));
    assert(feed.urls && feed.urls.length);

    object.filter_empty_properties(feed);

    // Allow explicit false
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const bound = create_feeds_executor.bind(null, session.conn, feeds);
  const cfp = new Promise(bound);
  const ids = await cfp;

  if (session.channel) {
    for (const id of ids) {
      const message = {type: 'feed-created', id: id};
      session.channel.postMessage(message);
    }
  }

  return ids;
}

function create_feeds_executor(conn, feeds, resolve, reject) {
  const ids = [];
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(ids);

  // TODO: move to top level
  function request_onsuccess(event) {
    ids.push(event.target.result);
  }

  const store = txn.objectStore('feed');
  for (const feed of feeds) {
    const request = store.put(feed);
    request.onsuccess = request_onsuccess;
  }
}
