import assert from '/src/assert.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

// Create several feeds using a single transaction. Feed objects in the input
// array may be modified.
export async function create_feeds(session, feeds) {
  // Validate
  for (const feed of feeds) {
    assert(types.is_feed(feed));
    assert(feed.urls && feed.urls.length);
  }

  // Sanitize
  for(const feed of feeds) {
    object.filter_empty_properties(feed);

    // Allow explicit false
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  // Store
  const ids = await new Promise((resolve, reject) => {
    const ids = [];
    const txn = session.conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => resolve(ids);

    function request_onsuccess(event) {
      ids.push(event.target.result);
    }

    const store = txn.objectStore('feed');
    for (const feed of feeds) {
      const request = store.put(feed);
      request.onsuccess = request_onsuccess;
    }
  });

  // Notify
  if (session.channel) {
    for (const id of ids) {
      const message = {type: 'feed-created', id: id};
      session.channel.postMessage(message);
    }
  }

  return ids;
}
