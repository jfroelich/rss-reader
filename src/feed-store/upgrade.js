import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
export function onUpgradeNeeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log('upgrading database %s to version %s from version', conn.name, conn.version,
    event.oldVersion);

  if(event.oldVersion < 20) {
    feedStore = conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
    entryStore = conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});
    feedStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});

    entryStore.createIndex('readState', 'readState');
    entryStore.createIndex('feed', 'feed');
    entryStore.createIndex('archiveState-readState', ['archiveState', 'readState']);
    entryStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feedStore = tx.objectStore('feed');
    entryStore = tx.objectStore('entry');
  }

  if(event.oldVersion < 21) {
    // Add magic to all older entries
    addEntryMagic(tx);
  }

  if(event.oldVersion < 22) {
    addFeedMagic(tx);
  }

  if(event.oldVersion < 23) {
    // Delete the title index in feed store. It is no longer in use. Because it is no longer
    // created, and the db could be at any prior version, ensure that it exists before calling
    // deleteIndex to avoid the FeedStoreErrors.NotFoundError deleteIndex throws when deleting a
    // non-existent index.

    // @type {DOMStringList}
    const indices = feedStore.indexNames;
    if(indices.contains('title')) {
      console.debug('deleting title index of feed store as part of upgrade');
      feedStore.deleteIndex('title');
    } else {
      console.debug('no title index found to delete during upgrade past version 22');
    }
  }

  if(event.oldVersion < 24) {
    // Version 24 adds an 'active' field to feeds. All existing feeds do not have an active
    // field. So all existing feeds must be modified to have an active property that is default
    // to true. It defaults to true because prior to this change, all feeds were presumed active.
    addActiveFieldToFeeds(feedStore);
  }
}

// Expects the transaction to be writable (either readwrite or versionchange)
function addEntryMagic(tx) {
  console.debug('Adding entry magic');
  const store = tx.objectStore('entry');
  const getAllEntriesRequest = store.getAll();
  getAllEntriesRequest.onerror = function(event) {
    console.error(getAllEntriesRequest.error);
  };
  getAllEntriesRequest.onsuccess = function(event) {
    const entries = event.target.result;
    writeEntriesWithMagic(store, entries);
  };
}

function writeEntriesWithMagic(entryStore, entries) {
  for(const entry of entries) {
    entry.magic = Entry.ENTRY_MAGIC;
    entry.dateUpdated = new Date();
    entryStore.put(entry);
  }
}

function addFeedMagic(tx) {
  console.debug('Adding feed magic');
  const store = tx.objectStore('feed');
  const getAllFeedsRequest = store.getAll();
  getAllFeedsRequest.onerror = console.error;
  getAllFeedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      feed.magic = Feed.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function addActiveFieldToFeeds(store) {
  console.debug('Adding active property to feeds');
  const feedsRequest = store.getAll();
  feedsRequest.onerror = console.error;

  feedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      console.debug('Marking feed %d as active as part of upgrade', feed.id);
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}
