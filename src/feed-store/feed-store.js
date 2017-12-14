/*
Implementation notes:

The basic idea is that I want reader-db and all its sub modules to use an object oriented api.
One reason is I like how favicon cache is implemented.
Two is because pretty much every function uses connection. Using an OO api would avoid the need
to pass around the connection as a paramter to every method.
Three is because it seams reasonable to be stateful. A cache instance is opened or closed.
Four is because I think dependency injection is still supportable. I just did not have a clear
picture of how it could work last time I tried.
Fifth is because I am less resistant to OO, I think I went a tad overboard with embracing c style,
and last time I attempted this I believe I discarded it because I wanted to use pure functions
and no objects.
Sixth is because I now have a better understanding that entry and feed objects are model objects
and not independent objects. They are closely tied to the model. They just represent a storage
format.

Note that as part of transition there will be some minor functionality changes. One being that
the isOpen stuff should belong here, instead of calling out to IndexedDbUtils directly. This
shields the caller from indexedDB a bit more, or in other words is more of a concrete abstraction.

Rather than rewrite the functionality in place, I am going to do it in phases:

1. Write the skeletal class.
2. Make basically wrapper functionality around reader-db calls in this class.
3. Update callers to use this class in place of directly accessing reader-db modules.
4. Inline all the wrapped functionality from reader-db and delete reader-db

Note, phases overlap. I am going function call by function call. Storing with opening and closing

*/

import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import activateFeed from "/src/reader-db/activate-feed.js";
import countUnreadEntries from "/src/reader-db/count-unread-entries.js";
import deactivateFeed from "/src/reader-db/deactivate-feed.js";
import entryAdd from "/src/reader-db/entry-add.js";
import markEntryAsRead from "/src/reader-db/entry-mark-read.js";
import findArchivableEntries from "/src/reader-db/find-archivable-entries.js";
import findEntries from "/src/reader-db/find-entries.js";
import findEntryById from "/src/reader-db/find-entry-by-id.js";
import findEntryIdByURL from "/src/reader-db/find-entry-id-by-url.js";
import findEntryIdsByFeedId from "/src/reader-db/find-entry-ids-by-feed-id.js";
import findFeedById from "/src/reader-db/find-feed-by-id.js";
import findFeedIdByURL from "/src/reader-db/find-feed-id-by-url.js";
import findViewableEntries from "/src/reader-db/find-viewable-entries.js";
import findActiveFeeds from "/src/reader-db/get-active-feeds.js";
import getAllFeedIds from "/src/reader-db/get-feed-ids.js";
import getAllFeeds from "/src/reader-db/get-feeds.js";
import openDb from "/src/reader-db/open.js";
import putEntry from "/src/reader-db/put-entry.js";
import putFeed from "/src/reader-db/put-feed.js";
import removeEntries from "/src/reader-db/remove-entries.js";
import removeFeed from "/src/reader-db/remove-feed.js";
import setup from "/src/reader-db/setup.js";

export default function FeedStore() {
  /* IDBDatabase */ this.conn;
}

FeedStore.prototype.open = async function() {
  this.conn = await openDb();
};

FeedStore.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FeedStore.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
};

FeedStore.prototype.activateFeed = function(feedId) {
  return activateFeed(this.conn, feedId);
};

FeedStore.prototype.addEntry = function(entry, channel) {
  return entryAdd(entry, this.conn, channel);
};

FeedStore.prototype.countUnreadEntries = function() {
  return countUnreadEntries(this.conn);
};

FeedStore.prototype.deactivateFeed = function(feedId, reason) {
  return deactivateFeed(this.conn, feedId, reason);
};

FeedStore.prototype.findArchivableEntries = function(predicate, limit) {
  return findArchivableEntries(this.conn, predicate, limit);
};

FeedStore.prototype.findEntries = function(predicate, limit) {
  return findEntries(this.conn, predicate, limit);
};

FeedStore.prototype.findEntryById = function(entryId) {
  return findEntryById(this.conn, entryId);
};

FeedStore.prototype.findEntryIdByURL = function(urlString) {
  return findEntryIdByURL(this.conn, urlString);
};

FeedStore.prototype.findEntryIdsByFeedId = function(feedId) {
  return findEntryIdsByFeedId(this.conn, feedId);
};

FeedStore.prototype.findFeedById = function(feedId) {
  return findFeedById(this.conn, feedId);
};

FeedStore.prototype.findFeedIdByURL = function(urlString) {
  return findFeedIdByURL(this.conn, urlString);
};

FeedStore.prototype.findViewableEntries = function(offset, limit) {
  return findViewableEntries(this.conn, offset, limit);
};

FeedStore.prototype.findActiveFeeds = function() {
  return findActiveFeeds(this.conn);
};

FeedStore.prototype.getAllFeedIds = function() {
  return getAllFeedIds(this.conn);
};

FeedStore.prototype.getAllFeeds = function() {
  return getAllFeeds(this.conn);
};

FeedStore.prototype.markEntryAsRead = function(entryId) {
  return markEntryAsRead(this.conn, entryId);
};

FeedStore.prototype.putEntry = function(entry) {
  return putEntry(this.conn, entry);
};

FeedStore.prototype.putFeed = function(feed, skipPrep) {
  return putFeed(feed, this.conn, skipPrep);
};

FeedStore.prototype.removeEntries = function(entryIds) {
  return removeEntries(this.conn, entryIds);
};

FeedStore.prototype.removeFeed = function(feedId, entryIds) {
  return removeFeed(this.conn, feedId, entryIds);
};

FeedStore.prototype.setup = setup;
