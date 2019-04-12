import filterEmptyProperties from '/lib/filter-empty-properties.js';

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

  const conn = event.target.result;

  const feedStore = conn.createObjectStore('feed', { keyPath: 'id', autoIncrement: true });
  feedStore.createIndex('urls', 'urls', { multiEntry: true, unique: true });

  const entryStore = conn.createObjectStore('entry', { keyPath: 'id', autoIncrement: true });

  entryStore.createIndex('readState', 'readState');
  entryStore.createIndex('feed', 'feed');
  entryStore.createIndex(
    'archiveState-readState', ['archiveState', 'readState'],
  );
  entryStore.createIndex('urls', 'urls', { multiEntry: true, unique: true });
}

// TODO: deprecate, no longer care about entry.magic
export function migrate21(event, channel) {}

// TODO: deprecate, no longer care about feed.magic
export function migrate22(event, channel) {}

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

  const { transaction } = event.target;
  const feedStore = transaction.objectStore('feed');

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

  if (feedStore.indexNames.contains('title')) {
    feedStore.deleteIndex('title');
  }
}

export function migrate24(event, channel) {
  if (!event.oldVersion) {
    return;
  }

  if (event.oldVersion > 23) {
    return;
  }

  // Set the active property for existing feeds to true
  const feed_ids = [];
  const { transaction } = event.target;
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function (event) {
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
    transaction.addEventListener('complete', (event) => {
      for (const id of feed_ids) {
        channel.postMessage({ type: 'feed-updated', id });
      }
    });
  }
}

export function migrate25(event, channel) {
  // This applies regardless of whether there is an old version

  if (event.oldVersion > 24) {
    return;
  }

  // Create an index on feed id and read state. This enables fast querying
  // of unread entries per feed.
  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entry');
  entryStore.createIndex('feed-readState', ['feed', 'readState']);
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

  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entry');

  // This modification step of this migration only applies when the database is
  // being upgraded, not when it is being created. If there are existing
  // entries, then ensure that all entries have a datePublished value.
  if (event.oldVersion) {
    const entry_ids = [];

    const request = entryStore.openCursor();
    request.onerror = _ => console.error(request.error);
    request.onsuccess = (event) => {
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
      transaction.addEventListener('complete', (event) => {
        for (const id of entry_ids) {
          channel.postMessage({ type: 'resource-updated', id });
        }
      });
    }
  }

  // This applies to both situations: when the database is being created for
  // the first time, and when the database is being updated
  entryStore.createIndex('datePublished', 'datePublished');
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

  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entry');

  const index_name = 'readState-datePublished';
  const index_path = ['readState', 'datePublished'];
  entryStore.createIndex(index_name, index_path);
}

export function migrate28(event, channel) {
  if (event.oldVersion > 27) {
    return;
  }

  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entry');
  const index_name = 'feed-datePublished';
  const index_path = ['feed', 'datePublished'];
  entryStore.createIndex(index_name, index_path);
}

export function migrate29(event, channel) {
  if (event.oldVersion > 28) {
    return;
  }

  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entry');
  const index_name = 'feed-readState-datePublished';
  const index_path = ['feed', 'readState', 'datePublished'];
  entryStore.createIndex(index_name, index_path);
}

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

  // Create the new stores and indices
  const feedStore = db.createObjectStore('feeds', { keyPath: 'id', autoIncrement: true });
  feedStore.createIndex('urls', 'urls', { multiEntry: true, unique: true });

  const entryStore = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });

  // The feed index is dropped from the store in 33. Retroactively we just avoid
  // creating it in the first place so as to minimize wasted work. The later
  // migration can handle both cases
  if (db.version < 33) {
    entryStore.createIndex('feed', 'feed');
  }

  entryStore.createIndex(
    'feed-readState-datePublished', ['feed', 'readState', 'datePublished'],
  );
  entryStore.createIndex(
    'readState-datePublished', ['readState', 'datePublished'],
  );
  entryStore.createIndex('readState', 'readState');
  entryStore.createIndex(
    'archiveState-readState', ['archiveState', 'readState'],
  );
  entryStore.createIndex('urls', 'urls', { multiEntry: true, unique: true });
  entryStore.createIndex('feed-readState', ['feed', 'readState']);
  entryStore.createIndex('feed-datePublished', ['feed', 'datePublished']);
  entryStore.createIndex('datePublished', 'datePublished');

  const { transaction } = event.target;

  // I decided not to generate events (dispatch messages to the channel) for
  // these operations. I do not think copying an object from one store to
  // another represents a creation or update of that object.

  // The check for whether the store exists seems like it should not be
  // necessary, but it is kind of unclear to me at the moment, so including the
  // check.

  // Copy over the feeds then delete the old store
  if (db.objectStoreNames.contains('feed')) {
    const old_feed_store = transaction.objectStore('feed');
    const feed_request = old_feed_store.openCursor();
    feed_request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        feedStore.put(cursor.value);
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
    entry_request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        entryStore.put(cursor.value);
        cursor.continue();
      } else {
        db.deleteObjectStore('entry');
      }
    };
  }
}

// Use snake_case instead of camelCase for object properties
export function migrate31(event, channel) {
  if (event.oldVersion > 30) {
    return;
  }

  const connection = event.target.result;

  // Ordinarily this check does not need to run, however there is a situation
  // in the test context where we attach all migrations to an upgrade handler
  // and then intentionally upgrade to an outdated version, and without this
  // check, that would lead to duplicate migrations (one or more premature
  // migrations).
  if (connection.version < 31) {
    return;
  }

  // Update relevant key paths. There is nothing to change in the feed store.

  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entries');

  entryStore.deleteIndex('feed-readState-datePublished');
  entryStore.createIndex(
    'feed-read_state-date_published',
    ['feed', 'read_state', 'date_published'],
  );

  entryStore.deleteIndex('readState-datePublished');
  entryStore.createIndex(
    'read_state-date_published', ['read_state', 'date_published'],
  );

  entryStore.deleteIndex('readState');
  entryStore.createIndex('read_state', 'read_state');

  entryStore.deleteIndex('archiveState-readState');
  entryStore.createIndex(
    'archive_state-read_state', ['archive_state', 'read_state'],
  );

  entryStore.deleteIndex('feed-readState');
  entryStore.createIndex('feed-read_state', ['feed', 'read_state']);

  entryStore.deleteIndex('feed-datePublished');
  entryStore.createIndex('feed-date_published', ['feed', 'date_published']);

  entryStore.deleteIndex('datePublished');
  entryStore.createIndex('date_published', 'date_published');

  // In the next iterations we use filter-empty-props so that we can wastefully
  // and lazily just copy props and then cleanup, instead of pedantically
  // inspecting for non-emptiness per property. Shouldn't be a big deal.

  // snake_case each feed object's properties
  const feedStore = transaction.objectStore('feeds');
  const feed_cursor_request = feedStore.openCursor();
  feed_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const feed = cursor.value;

    feed.deactivation_reason_text = feed.deactivationReasonText;
    delete feed.deactivationReasonText;

    feed.deactivate_date = feed.deactivateDate;
    delete feed.deactivateDate;

    feed.date_created = feed.dateCreated;
    delete feed.dateCreated;

    feed.date_updated = feed.dateUpdated;
    delete feed.dateUpdated;

    feed.date_published = feed.datePublished;
    delete feed.datePublished;

    feed.favicon_url_string = feed.faviconURLString;
    delete feed.faviconURLString;

    filterEmptyProperties(feed);

    feedStore.put(feed);
    cursor.continue();
  };

  // Next, replace each entry object with its proper snake case
  const entry_cursor_request = entryStore.openCursor();
  entry_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const entry = cursor.value;

    entry.feed_title = entry.feedTitle;
    delete entry.feedTitle;

    entry.read_state = entry.readState;
    delete entry.readState;

    entry.archive_state = entry.archiveState;
    delete entry.archiveState;

    entry.date_created = entry.dateCreated;
    delete entry.dateCreated;

    entry.date_read = entry.dateRead;
    delete entry.dateRead;

    entry.date_updated = entry.dateUpdated;
    delete entry.dateUpdated;

    entry.date_published = entry.datePublished;
    delete entry.datePublished;

    entry.favicon_url_string = entry.faviconURLString;
    delete entry.faviconURLString;

    if (entry.enclosure && entry.enclosure.enclosureLength) {
      entry.enclosure.enclosure_length = entry.enclosure.enclosureLength;
      delete entry.enclosure.enclosureLength;
    }

    filterEmptyProperties(entry);

    entryStore.put(entry);
    cursor.continue();
  };
}

export function migrate32(event, channel) {
  const connection = event.target.result;
  if (connection.version < 32) {
    return;
  }

  if (event.oldVersion > 31) {
    return;
  }

  // This migration focuses on normalizing property names to some degree. In
  // particular, names for dates should use a date suffix instead of a prefix.
  // This means that derived indices should also use proper names, so start by
  // modifying the appropriate indices.

  // There are no feed indices to modify

  // Update relevant entries object store indices
  const { transaction } = event.target;
  const entryStore = transaction.objectStore('entries');

  entryStore.deleteIndex('feed-read_state-date_published');
  entryStore.createIndex(
    'feed-read_state-published_date',
    ['feed', 'read_state', 'published_date'],
  );

  entryStore.deleteIndex('feed-date_published');
  entryStore.createIndex('feed-published-date', ['feed', 'published_date']);

  entryStore.deleteIndex('read_state-date_published');
  entryStore.createIndex(
    'read_state-published_date', ['read_state', 'published_date'],
  );

  entryStore.deleteIndex('date_published');
  entryStore.createIndex('published_date', 'published_date');

  // Update existing feeds
  const feedStore = transaction.objectStore('feeds');
  const feed_cursor_request = feedStore.openCursor();
  feed_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const feed = cursor.value;

    feed.deactivation_reason = feed.deactivation_reason_text;
    delete feed.deactivation_reason_text;

    feed.deactivation_date = feed.deactivate_date;
    delete feed.deactivate_date;

    feed.created_date = feed.date_created;
    delete feed.date_created;

    feed.updated_date = feed.date_updated;
    delete feed.date_updated;

    feed.published_date = feed.date_published;
    delete feed.date_published;

    feed.favicon_url = feed.favicon_url_string;
    delete feed.favicon_url_string;

    filterEmptyProperties(feed);

    feedStore.put(feed);
    cursor.continue();
  };

  // Update existing entries
  const entry_cursor_request = entryStore.openCursor();
  entry_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const entry = cursor.value;

    entry.created_date = entry.date_created;
    delete entry.date_created;

    entry.read_date = entry.date_read;
    delete entry.date_read;

    entry.updated_date = entry.date_updated;
    delete entry.date_updated;

    entry.published_date = entry.date_published;
    delete entry.date_published;

    entry.favicon_url = entry.favicon_url_string;
    delete entry.favicon_url_string;

    entryStore.put(entry);
    cursor.continue();
  };
}

export function migrate33(event, channel) {
  const connection = event.target.result;
  if (connection.version < 33) {
    return;
  }

  if (event.oldVersion > 32) {
    return;
  }

  // In this migration from 32 to 33, we drop the feed index, if it exists.
  // We check for existence in case it was not created in the first place. It
  // was last modified in migration 30 when renaming the entry object store.
  // That migration was retroactively modified to no longer create the index
  // when upgrading to a version less than 33.

  const { transaction } = event.target;
  const entries_store = transaction.objectStore('entries');

  if (entries_store.indexNames.contains('feed')) {
    entries_store.deleteIndex('feed');
  }
}

export function migrate34(event, channel) {
  const connection = event.target.result;
  if (connection.version < 34) {
    return;
  }

  if (event.oldVersion > 33) {
    return;
  }

  const { transaction } = event.target;
  const feeds_store = transaction.objectStore('feeds');
  const feeds_cursor = feeds_store.openCursor();
  const feed_ids = [];
  feeds_cursor.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const feed = cursor.value;
      feed_ids.push(feed.id);
      delete feed.magic;
      feeds_store.put(feed);
      cursor.continue();
    }
  };

  const entries_store = transaction.objectStore('entries');
  const entries_cursor = entries_store.openCursor();
  const entry_ids = [];
  entries_cursor.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const entry = cursor.value;
      entry_ids.push(entry.id);
      delete entry.magic;
      entries_store.put(entry);
      cursor.continue();
    }
  };

  if (channel) {
    transaction.addEventListener('complete', (event) => {
      for (const id of feed_ids) {
        channel.postMessage({ type: 'feed-updated', id });
      }

      for (const id of entry_ids) {
        channel.postMessage({ type: 'resource-updated', id });
      }
    });
  }
}

// Switch from feeds and entries stores to a single resources store
export function migrate35(event, channel) {
  const connection = event.target.result;
  const { transaction } = event.target;

  if (connection.version < 35) {
    return;
  }

  if (event.oldVersion > 34) {
    return;
  }

  // Create the resources store and appropriate indices
  const resources_store = connection.createObjectStore(
    'resources', { keyPath: 'id', autoIncrement: true },
  );
  resources_store.createIndex('urls', 'urls', { multiEntry: true, unique: true });

  // Each resource object gets a type so ops can quickly find all feeds or
  // query only entries
  resources_store.createIndex('type', 'type');

  resources_store.createIndex('type-read', ['type', 'read']);

  const feeds_store = transaction.objectStore('feeds');
  const feeds_store_cursor_request = feeds_store.openCursor();
  feeds_store_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const feed = cursor.value;

      // rename type to a more specific type so it does not conflict with
      // planned type
      if (feed.type) {
        feed.feed_format = feed.type;
        delete feed.type;
      }

      // boolean to int
      feed.active = feed.active ? 1 : 0;

      // introduce resource type
      feed.type = 'feed';

      resources_store.put(feed);
      cursor.continue();
    } else {
      connection.deleteObjectStore('feeds');
    }
  };

  const entries_store = transaction.objectStore('entries');
  const entries_store_cursor_request = entries_store.openCursor();
  entries_store_cursor_request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const entry = cursor.value;
      // introduce new type
      entry.type = 'entry';

      // rename feed to parent
      entry.parent = entry.feed;
      delete entry.feed;

      if (entry.feed_title) {
        entry.parent_title = entry.feed_title;
        delete entry.feed_title;
      }

      // rename read state and archive state
      entry.archived = entry.archive_state;
      delete entry.archive_state;
      entry.read = entry.read_state;
      delete entry.read_state;

      resources_store.put(entry);
      cursor.continue();
    } else {
      connection.deleteObjectStore('entries');
    }
  };
}
