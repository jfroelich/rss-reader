import * as db from '/src/db/db.js';
import assert from '/src/lib/assert.js';

// TODOS:
// Migrate all clients of db that do feed related calls to instead use this
// Move normalization and sanitization to here from db layer, but keep validation there for now
// Move broadcasting to here (e.g. db.open returns first class IDBDatabase instance that is not
// wrapped just to stash the channel property, instead the channel property is generated here).

export function open(timeout) {
  return db.open(timeout);
}

export function countEntries(conn, query) {
  return db.countResources(conn, query);
}

export function countUnreadEntries(conn) {
  const query = { type: 'entry', read: 0 };
  return db.countResources(conn, query);
}

export function createEntry(conn, entry) {
  return db.createResource(conn, entry);
}

// Creates a feed in the database. Returns a promise that resolves once the feed is committed. For
// performance, this mutates the input object directly. The promise resolves to the new feed id.
export function createFeed(conn, feed) {
  if (typeof feed.type !== 'undefined') {
    assert(feed.type === 'feed');
  } else {
    feed.type = 'feed';
  }

  // Feeds must have a url
  // TODO: remove the corresponding sanity check that happens within createResource once all
  // clients use this function instead
  assert(Array.isArray(feed.urls) && feed.urls.length);

  // TODO: impute things like active.
  // TODO: remove the corresponding imputation from createResource once all clients migrated
  // to using this function instead

  // TODO: normalize, sanitize, validate, filter empty properties, etc.
  // Although maybe empty property filtering actually does belong in db layer only.
  // Or maybe validation still occurs at db layer but sanitization and normalization occur here?

  // TODO: instead of returning a promise, await this, then do channel broadcast, then
  // return. move the channel broadcasting out of create-resource. also, reintroduce
  // the feed-specific message type 'feed-created'.

  return db.createResource(conn, feed);
}

export function createFeeds(conn, feeds) {
  const promises = feeds.map(feed => createFeed(conn, feed));
  return Promise.all(promises);
}

export function deleteFeed(conn, id, reason) {
  return db.deleteResource(conn, id, reason);
}

export function deleteEntry(conn, id, reason) {
  return db.deleteResource(conn, id, reason);
}

export function getFeed(conn, query) {
  return db.getResource(conn, query);
}

export function getEntry(conn, query) {
  return db.getResource(conn, query);
}

export function getEntries(conn, query) {
  // TODO: 'all' is hack to support archive-entries test
  const supportedModes = ['viewable-entries', 'archivable-entries', 'all'];
  assert(supportedModes.includes(query.mode));

  return db.getResources(conn, query);
}

export function getFeeds(conn, query) {
  const supportedModes = ['feeds', 'active-feeds'];
  assert(supportedModes.includes(query.mode));

  return db.getResources(conn, query);
}

export function patchEntry(conn, props) {
  return db.patchResource(conn, props);
}

export function patchFeed(conn, props) {
  return db.patchResource(conn, props);
}

export function putEntry(conn, entry) {
  return db.putResource(conn, entry);
}

export function putFeed(conn, feed) {
  return db.putResource(conn, feed);
}
