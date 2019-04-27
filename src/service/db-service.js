// TODO: deprecate, I don't like this, feels wrong, this is introducing indirection without value

import * as db from '/src/db/db.js';
import assert from '/src/lib/assert.js';

export const { open } = db;
export const { countEntries } = db;
export const { ConstraintError } = db;

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

  assert(Array.isArray(feed.urls) && feed.urls.length);

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
