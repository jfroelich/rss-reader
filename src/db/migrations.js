import * as types from '/src/db/types.js';

// The migrations module provides transition functions that handle creating the
// schema of the database or applying changes to it when the database version
// changes.

// Each migration function assumes it is always called when the database version
// has changed, and includes logic to exit early when the particular migration
// function is inapplicable. This way the caller can simply invoke all the
// migration functions in order without expressing conditions that require
// knowledge of whether the migration is applicable.

// It is important to note a subtlety here in how migrations apply. A migration
// does not apply to only the previous version of the database. It applies to
// any prior state of the database. For example, a migration function that
// migrates to version 3 may be applying to a database being created (there is
// no version 1 and 2), it may be applying to 1 (version 2 was skipped), or it
// may be applying to 2, the previous version.

// Each migration function assumes that all other applicable migrations are
// performed. For example, an upgrade to version 3 will assume that the
// migration functions for upgrading to version 1 and version 2 will also be
// running as a part of the same transaction and invoked prior.

// Each migration function receives two parameters, event and channel. The event
// parameter provides access to the database and the upgrade transaction that is
// occuring. The channel parameter is optional (it may not be set), and enables
// each migration function to opt in to notifying observers of certain database
// changes.

// Useful things to remember in implementation:
// * event.target - grabs the database open request
// * event.target.transaction - grabs the version change transaction
// * event.target.result - grabs the database connection
// * event.target.result.version - grabs the current version (being upgraded
// to), this will always be a number greater than 0, this value corresponds to
// the version parameter given to indexedDB.open
// * event.oldVersion - grabs the old version, this is 0 when the database
// is being created

// Migrate the database from any previous version to 20
export function migrate20(event, channel) {
  if (event.oldVersion) {
    return;
  }

  if (event.oldVersion > 19) {
    return;
  }

  console.debug('Applying migration 20');

  const conn = event.target.result;

  console.debug('Creating feed object store');

  const feed_store =
      conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
  feed_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});

  console.debug('Creating entry object store');

  const entry_store =
      conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});

  entry_store.createIndex('readState', 'readState');
  entry_store.createIndex('feed', 'feed');
  entry_store.createIndex(
      'archiveState-readState', ['archiveState', 'readState']);
  entry_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});
}

export function migrate21(event, channel) {
  if (!event.oldVersion) {
    return;
  }

  if (event.oldVersion > 20) {
    return;
  }

  console.debug('Applying migration 21');

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
  if (!event.oldVersion) {
    return;
  }

  if (event.oldVersion > 21) {
    return;
  }

  console.debug('Applying migration 22');

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

export function migrate23(event, channel) {
  // This migration only applies to databases that exist
  if (!event.oldVersion) {
    return;
  }

  // This migration only applies if upgrading from a version that is older
  // than version 23
  if (event.oldVersion > 22) {
    return;
  }

  console.debug('Applying migration 23');

  const transaction = event.target.transaction;
  const feed_store = transaction.objectStore('feed');

  // In this migration, the title index is no longer in use because of problems
  // with how indexedDB indices exclude objects that are missing properties.
  // The view would load all feeds sorted by title and it would not display all
  // feeds because untitled feeds were filtered.

  // NOTE: the title index is no longer created in the earlier migration, the
  // original migration (either 20 or some lost code from before it) created the
  // index but then that code was completely removed. If I recall the thinking
  // was that there is no point to creating an index if it will just be removed.
  // Therefore, this cannot assume the index actually exists. deleteIndex fails
  // with an error when trying to delete an index that does not exist. To work
  // around this triggering an exception, check if the index exists.

  // The original error: Uncaught DOMException: Failed to execute 'deleteIndex'
  // on 'IDBObjectStore': The specified index was not found.

  if (feed_store.indexNames.contains('title')) {
    console.debug('Deleting title index on feed store');
    feed_store.deleteIndex('title');
  } else {
    console.debug('No title index found in migration23');
  }
}

export function migrate24(event, channel) {
  if (!event.oldVersion) {
    return;
  }

  if (event.oldVersion > 23) {
    return;
  }

  console.debug('Applying migration 24');

  // Set the active property for existing feeds to true
  const feed_ids = [];
  const transaction = event.target.transaction;
  const feed_store = transaction.objectStore('feed');
  const request = feed_store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed_ids.push(feed.id);
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };

  // Notify listeners of each updated feed
  if (channel) {
    transaction.addEventListener('complete', event => {
      for (const id of feed_ids) {
        channel.postMessage({type: 'feed-updated', id: id});
      }
    });
  }
}

export function migrate25(event, channel) {
  // This applies regardless of whether there is an old version

  if (event.oldVersion > 24) {
    return;
  }

  console.debug('Applying migration 25');

  // Create an index on feed id and read state. This enables fast querying
  // of unread entries per feed.
  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');
  entry_store.createIndex('feed-readState', ['feed', 'readState']);
}

// Handle upgrading to or past version 26 from all prior versions.
// This version adds an index on the entry store on the datePublished
// property, so that all entries can be loaded sorted by datePublished
export function migrate26(event, channel) {
  // This migration applies regardless of whether there is an old version

  // This migration should not be done when upgrading from version 26 or later
  if (event.oldVersion > 25) {
    return;
  }

  console.debug('Applying migration 26');

  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');

  // This modification step of this migration only applies when the database is
  // being upgraded, not when it is being created. If there are existing
  // entries, then ensure that all entries have a datePublished value.
  if (event.oldVersion) {
    const entry_ids = [];

    const request = entry_store.openCursor();
    request.onerror = _ => console.error(request.error);
    request.onsuccess = event => {
      const cursor = request.result;
      if (cursor) {
        const entry = cursor.value;
        if (!entry.datePublished) {
          entry.datePublished = entry.dateCreated;
          entry.dateUpdated = new Date();
          cursor.update(entry);
        }
        cursor.continue();
      }
    };

    if (channel) {
      transaction.addEventListener('complete', event => {
        for (const id of entry_ids) {
          channel.postMessage({type: 'entry-updated', id: id});
        }
      });
    }
  }

  // This applies to both situations: when the database is being created for
  // the first time, and when the database is being updated
  entry_store.createIndex('datePublished', 'datePublished');
}

// Handle upgrade to 27 from all prior versions. This version
// adds a new index for use in the reader-page view.
// TODO: now that reader-view is no longer in use this index should be removed
export function migrate27(event, channel) {
  // This migration applies to all prior versions but not to versions that
  // are 27 or greater
  if (event.oldVersion > 26) {
    return;
  }

  console.debug('Applying migration 27');

  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');

  const index_name = 'readState-datePublished';
  const index_path = ['readState', 'datePublished'];
  entry_store.createIndex(index_name, index_path);
}

export function migrate28(event, channel) {
  if (event.oldVersion > 27) {
    return;
  }

  console.debug('Applying migration 28');

  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');
  const index_name = 'feed-datePublished';
  const index_path = ['feed', 'datePublished'];
  entry_store.createIndex(index_name, index_path);
}

export function migrate29(event, channel) {
  if (event.oldVersion > 28) {
    return;
  }

  console.debug('Applying migration 29');

  const transaction = event.target.transaction;
  const entry_store = transaction.objectStore('entry');
  const index_name = 'feed-readState-datePublished';
  const index_path = ['feed', 'readState', 'datePublished'];
  entry_store.createIndex(index_name, index_path);
}

// TODO: before going live, implement a test for this migration and confirm it
// copies over data. Once the test works, change all db functions to use the
// plural names, then go live.
export function migrate30(event, channel) {
  if (event.oldVersion > 29) {
    return;
  }

  const db = event.target.result;

  // In the test context we might be using this migration in a handler, but
  // trying to open an antiquated version, so we also need this check
  if (db.version < 30) {
    return;
  }

  console.debug('Applying migration 30');

  // Create the new stores and indices
  const feed_store =
      db.createObjectStore('feeds', {keyPath: 'id', autoIncrement: true});
  feed_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});

  const entry_store =
      db.createObjectStore('entries', {keyPath: 'id', autoIncrement: true});
  entry_store.createIndex('feed', 'feed');
  entry_store.createIndex(
      'feed-readState-datePublished', ['feed', 'readState', 'datePublished']);
  entry_store.createIndex(
      'readState-datePublished', ['readState', 'datePublished']);
  entry_store.createIndex('readState', 'readState');
  entry_store.createIndex(
      'archiveState-readState', ['archiveState', 'readState']);
  entry_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  entry_store.createIndex('feed-readState', ['feed', 'readState']);
  entry_store.createIndex('feed-datePublished', ['feed', 'datePublished']);
  entry_store.createIndex('datePublished', 'datePublished');

  const transaction = event.target.transaction;

  // I decided not to generate events (dispatch messages to the channel) for
  // these operations. I do not think copying an object from one store to
  // another represents a creation or update of that object.

  // The check for whether the store exists seems like it should not be
  // necessary, but it is kind of unclear to me at the moment, so including the
  // check.

  // TODO: once the test confirms this works remove the temporary logging

  // Copy over the feeds then delete the old store
  if (db.objectStoreNames.contains('feed')) {
    const old_feed_store = transaction.objectStore('feed');
    const feed_request = old_feed_store.openCursor();
    feed_request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        console.debug('Copying feed', cursor.value.id);
        feed_store.put(cursor.value);
        cursor.continue();
      } else {
        // At this time it is finally safe to delete the store
        db.deleteObjectStore('feed');
      }
    };
  }


  // Copy over the entries then delete the old store
  if (db.objectStoreNames.contains('entry')) {
    const old_entry_store = transaction.objectStore('entry');
    const entry_request = old_entry_store.openCursor();
    entry_request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        console.debug('Copying entry', cursor.value.id);
        entry_store.put(cursor.value);
        cursor.continue();
      } else {
        db.deleteObjectStore('entry');
      }
    };
  }
}
