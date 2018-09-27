import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

// Connects to the model. Instantiates and returns a wrapper class that serves
// as a data access layer for reading from and writing to app persistent storage
//
// @param is_channeled {Boolean} optional, if true then this establishes a
// connection to the app's broadcast channel that will potentially be used by
// methods that modify database state. Generally, use true when reading and
// writing, and use false when only reading.
// @param name {String} optional, database name
// @param version {Number} optional, database version
// @param timeout {Number} optional, ms before considering opening attempt a
// failure
// @throws {DOMException} some kind of database error, failed to connect,
// failed to apply upgrades to new version, etc.
// @throws {Error} invalid arguments
// @throws {Error} failed to create channel
// @return {Promise} resolves to a ModelAccess object
export async function openModelAccess(is_channeled, name, version, timeout) {
  const ma = new ModelAccess();
  if (is_channeled) {
    ma.channel = new BroadcastChannel('reader');
  }

  name = name === undefined ? 'reader' : name;
  version = version === undefined ? 24 : version;
  timeout = timeout === undefined ? 500 : timeout;
  ma.conn = await idbmodel.open(name, version, undefined, timeout);
  return ma;
}

export function ModelAccess() {
  this.conn = undefined;
  this.channel = undefined;
}

ModelAccess.prototype.close = function() {
  if (this.channel) {
    this.channel.close();
  }
  this.conn.close();
};


ModelAccess.prototype.createFeed = async function(feed) {
  assert(types.is_feed(feed));
  assert(feed.urls && feed.urls.length);
  object.filter_empty_properties(feed);

  if (feed.active === undefined) {
    feed.active = true;
  }

  feed.dateCreated = new Date();
  delete feed.dateUpdated;

  const id = await idbmodel.create_feed(this.conn, feed);
  this.channel.postMessage({type: 'feed-created', id: id});
  return id;
};

ModelAccess.prototype.createFeeds = async function(feeds) {
  for (const feed of feeds) {
    assert(types.is_feed(feed));
    assert(feed.urls && feed.urls.length);

    object.filter_empty_properties(feed);

    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
  }

  const ids = await idbmodel.create_feeds(this.conn, feeds);
  for (const id of ids) {
    this.channel.postMessage({type: 'feed-created', id: id});
  }

  // NOTE: this was previously a bug, this must return the set of new ids, not
  // undefined, null, or an array of feed objects
  return ids;
};

ModelAccess.prototype.countUnreadEntries = function() {
  return idbmodel.count_unread_entries(this.conn);
};

ModelAccess.prototype.deactivateFeed = async function(feed_id, reason) {
  assert(feed_utils.is_valid_feed_id(feed_id));
  await idbmodel.deactivate_feed(this.conn, feed_id, reason);
  this.channel.postMessage({type: 'feed-deactivated', id: feed_id});
};

ModelAccess.prototype.deleteEntry = async function(id, reason) {
  assert(entry_utils.is_valid_entry_id(id));
  await idbmodel.delete_entry(this.conn, id);
  this.channel.postMessage({type: 'entry-deleted', id: id, reason: reason});
};

ModelAccess.prototype.deleteFeed = async function(feed_id, reason) {
  assert(feed_utils.is_valid_feed_id(feed_id));
  const entry_ids = await idbmodel.delete_feed(this.conn, feed_id);

  this.channel.postMessage({type: 'feed-deleted', id: feed_id, reason: reason});
  for (const id of entry_ids) {
    this.channel.postMessage(
        {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
  }
};

ModelAccess.prototype.getEntries = function(mode = 'all', offset, limit) {
  assert(
      offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0));
  assert(
      limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0));

  return idbmodel.get_entries(this.conn, mode, offset, limit);
};

ModelAccess.prototype.getEntry = function(mode = 'id', value, key_only) {
  assert(mode !== 'id' || entry_utils.is_valid_entry_id(value));
  assert(mode !== 'id' || !key_only);
  return idbmodel.get_entry(this.conn, mode, value, key_only);
};

ModelAccess.prototype.getFeedIds = function() {
  return idbmodel.get_feed_ids(this.conn);
};

ModelAccess.prototype.getFeed = function(mode = 'id', value, key_only) {
  assert(mode !== 'url' || (value && typeof value.href === 'string'));
  assert(mode !== 'id' || feed_utils.is_valid_feed_id(value));
  assert(mode !== 'id' || !key_only);

  return idbmodel.get_feed(this.conn, mode, value, key_only);
};

ModelAccess.prototype.getFeeds = async function(mode = 'all', sort = false) {
  let feeds = await idbmodel.get_feeds(this.conn);

  if (mode === 'active') {
    feeds = feeds.filter(feed => feed.active);
  }

  if (sort) {
    feeds.sort(compare_feeds);
  }

  return feeds;
};

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

ModelAccess.prototype.iterateEntries = function(handle_entry) {
  assert(typeof handle_entry === 'function');
  return idbmodel.iterate_entries(this.conn, handle_entry);
};

ModelAccess.prototype.markEntryRead = async function(entry_id) {
  assert(entry_utils.is_valid_entry_id(entry_id));
  await idbmodel.mark_entry_read(this.conn, entry_id);
  this.channel.postMessage({type: 'entry-read', id: entry_id});
};

ModelAccess.prototype.removeLostEntries = async function() {
  const ids = await idbmodel.remove_lost_entries(this.conn);
  for (const id of ids) {
    this.channel.postMessage({type: 'entry-deleted', id: id, reason: 'lost'});
  }
};

// Scans the database for entries not linked to a feed and deletes them
ModelAccess.prototype.removeOrphanedEntries = async function() {
  const ids = await idbmodel.remove_orphaned_entries(this.conn);
  for (const id of entry_ids) {
    this.channel.postMessage({type: 'entry-deleted', id: id, reason: 'orphan'});
  }
};

// Scan the feed store and the entry store and delete any objects missing their
// hidden magic property. This is not 'thread-safe' because this uses multiple
// write transactions.
ModelAccess.prototype.removeUntypedObjects = async function() {
  const {feed_ids, entry_ids} =
      await idbmodel.remove_untyped_objects(this.conn);

  for (const id of feed_ids) {
    this.channel.postMessage({type: 'feed-deleted', id: id, reason: 'untyped'});
  }

  for (const id of entry_ids) {
    this.channel.postMessage(
        {type: 'entry-deleted', id: id, reason: 'untyped'});
  }
};

ModelAccess.prototype.updateEntry = async function(entry) {
  assert(types.is_entry(entry));
  assert(entry_utils.is_valid_entry_id(entry.id));

  // TODO: should this be asserting entry.urls similar to updateFeed?

  entry.dateUpdated = new Date();
  object.filter_empty_properties(entry);

  await idbmodel.update_entry(this.conn, entry);
  this.channel.postMessage({type: 'entry-updated', id: entry.id});
};

ModelAccess.prototype.updateFeed = async function(feed) {
  assert(types.is_feed(feed));
  assert(feed.urls && feed.urls.length);
  assert(feed_utils.is_valid_feed_id(feed.id));

  object.filter_empty_properties(feed);
  feed.dateUpdated = new Date();

  await idbmodel.update_feed(this.conn, feed);
  this.channel.postMessage({type: 'feed-updated', id: feed.id});
};
