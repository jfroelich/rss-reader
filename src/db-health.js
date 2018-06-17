import * as db from '/src/db.js';

// Removes entries missing urls from the database
// TODO: test
export async function remove_lost_entries(conn, channel) {
  // Track ids so they are available after txn commits
  const deleted_entry_ids = [];
  const txn_writable = true;
  await db.iterate_entries(conn, 'all', txn_writable, cursor => {
    const entry = cursor.value;
    // TODO: accessing entry.urls still means too much knowledge of feed
    // structure
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      deleted_entry_ids.push(entry.id);
    }
  });

  // Wait till txn commits before dispatch
  for (const id of deleted_entry_ids) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: 'lost'});
  }
}

// Scans the database for entries not linked to a feed and deletes them
// TODO: test
export async function remove_orphaned_entries(conn, channel) {
  // Query for all feed ids. We load just the ids so that it is faster and more
  // scalable than actually loading all feed info.
  const feed_ids = await db.get_feed_ids(conn);

  // Technically we could continue and let the next transaction do nothing, but
  // it is better for performance to preemptively exit.
  if (!feed_ids.length) {
    return;
  }

  // Maintain a buffer of deleted entry ids so that it is available after the
  // transaction commits for use by operations that should not occur until
  // after the commit.
  const deleted_entry_ids = [];

  // Walk the entry store in write mode
  const txn_writable = true;
  await db.iterate_entries(conn, 'all', txn_writable, cursor => {
    const entry = cursor.value;

    // If the entry object type is invalid, ignore it
    if (!db.is_entry(entry)) {
      return;
    }

    // If the entry has a valid feed id, ignore it
    if (db.is_valid_feed_id(entry.feed)) {
      return;
    }

    // If the entry's feed id is a known feed id, ignore it
    if (feed_ids.includes(entry.feed)) {
      return;
    }

    // We found an entry with a bad feed id. Record that it will be deleted once
    // the transaction commits, request its deletion
    deleted_entry_ids.push(entry.id);
    cursor.delete();
  });

  // Now that txn committed, let everyone know of state changes
  for (const id of deleted_entry_ids) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: 'orphan'});
  }
}

// Scan the feed store and the entry store and delete any objects missing their
// hidden magic property. Note this uses multiple write transactions. That means
// that a later failure does not indicate an earlier step failed.
// TODO: use a single transaction
export function remove_untyped_objects(conn, channel) {
  const feeds = db.get_feeds(conn);
  const delete_feed_promises = [];
  for (const feed of feeds) {
    if (!db.is_feed(feed)) {
      console.debug('Deleting untyped feed', feed);
      const promise = db.delete_feed(conn, channel, feed.id, 'untyped');
      delete_feed_promises.push(promise);
    }
  }

  // Wait for all deletes to resolve. Deleting feeds could delete entries, so
  // by waiting we avoid redundancy with the next step
  await Promise.all(delete_feed_promises);

  // Delete entries. Rather than use delete_entry explicitly, this deletes
  // several entries in a single transaction.
  const deleted_entries = [];
  const txn_writable = true;
  await db.iterate_entries(conn, 'all', txn_writable, cursor => {
    const entry = cursor.value;
    if (!db.is_entry(entry)) {
      // Collect only necessary properties for the channel post rather than
      // keeping the full objects around in memory
      deleted_entries.push({id: entry.id, feed: entry.feed});
      cursor.delete();
    }
  });

  // Once the delete-entries transaction settles, it is now safe to notify
  // observers in a consistent manner.
  for (const entry of deleted_entries) {
    channel.postMessage({
      type: 'entry-deleted',
      id: entry.id,
      // Use feed_id to remain consistent with db.delete_feed's channel protocol
      feed_id: entry.feed,
      reason: 'orphan'
    });
  }
}
