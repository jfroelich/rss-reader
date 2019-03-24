import * as types from '/src/db/types.js';


// Migrate the database from any previous version to 20
export function migrate20(event, channel) {
  const conn = event.target.result;

  const feed_store =
      conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
  feed_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});

  const entry_store =
      conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});

  entry_store.createIndex('readState', 'readState');
  entry_store.createIndex('feed', 'feed');
  entry_store.createIndex(
      'archiveState-readState', ['archiveState', 'readState']);
  entry_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});
}

export function migrate21(event, channel) {
  // Add a magic property to each entry
  const entry_ids = [];
  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');
  const request = entry_store.openCursor();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function() {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!('magic' in entry)) {
        entry_ids.push(entry.id);
        entry.magic = types.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
      cursor.continue();
    }
  };

  // Listen for complete if there is a channel attached
  if (channel) {
    // If the transaction is committed then notify listeners
    transaction.addEventListener('complete', event => {
      for (const id of entry_ids) {
        channel.postMessage({type: 'entry-updated', id: id});
      }
    });
  }
}

export function migrate22(event, channel) {
  const transaction = event.target.transaction;

  // Add magic property to feeds

  // Retain a list of ids of modified feeds so that we can notify listeners once
  // the transaction commits
  const feed_ids = [];

  // We only bother to do this when data may exist. If the old version is unset
  // then there are no feeds to modify.
  if (event.oldVersion) {
    const feed_store = transaction.objectStore('feed');
    const request = feed_store.getAll();
    request.onerror = _ => console.error(request.error);
    request.onsuccess = function(event) {
      const feeds = event.target.result;
      for (const feed of feeds) {
        feed_ids.push(feed.id);
        feed.magic = types.FEED_MAGIC;
        feed.dateUpdated = new Date();
        feed_store.put(feed);
      }
    };
  }

  // If there is a channel, then register a listener that fires a message once
  // the transaction commits
  if (channel) {
    transaction.addEventListener('complete', event => {
      for (const id of feed_ids) {
        channel.postMessage({type: 'feed-updated', id: id});
      }
    });
  }
}
