import * as db from '/src/core/db.js';
import {INDEFINITE} from '/src/lib/deadline.js';

// clang-format off
export {
  Entry,
  Feed,
  InvalidStateError,
  is_entry,
  is_feed,
  NotFoundError,
  ValidationError
} from '/src/core/db.js';
// clang-format on

class CDB {
  constructor() {
    this.db = new db.Db();
    this.channel = undefined;
    this.channel_name = 'reader';
  }

  async open() {
    await this.db.open();
    this.channel = new BroadcastChannel(this.channel_name);
  }

  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = undefined;
    }

    this.db.close();
  }
}

// Temporary helpers due to db.js refactor as object
export function validate_feed(feed) {
  const conn = new db.Db();
  return conn.validateFeed(feed);
}

export function validate_entry(entry) {
  const conn = new db.Db();
  return conn.validateEntry(entry);
}

export function sanitize_feed(feed) {
  const conn = new db.Db();
  return conn.sanitizeFeed(feed);
}

export function sanitize_entry(entry) {
  const conn = new db.Db();
  return conn.sanitizeEntry(entry);
}


class CDBSession {
  constructor() {
    this.conn = undefined;
    this.channel = undefined;
  }

  close() {
    if (this.channel) {
      this.channel.close();
    }

    if (this.conn) {
      this.conn.close();
    }

    // Nullify the props to force errors in places that use props incorrectly
    // Set to undefined instead of delete to maintain v8 object shape
    this.channel = undefined;
    this.conn = undefined;
  }
}

export async function open(
    name, version, timeout = INDEFINITE, channel_name = 'reader') {
  const session = new CDBSession();
  session.channel = new BroadcastChannel(channel_name);

  // This funkiness is because I am refactoring db alone, before revising
  // cdb as well
  const conn = new db.Db();
  conn.name = name || 'reader';
  conn.version = version || 29;
  conn.timeout = timeout;
  await conn.open();
  session.conn = conn.conn;

  return session;
}

export async function archive_entries(session, max_age) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const ids = await conn.archiveEntries(max_age);
  for (const id of ids) {
    session.channel.postMessage({type: 'entry-archived', id: id});
  }
}

export function count_unread_entries_by_feed(session, id) {
  const conn = new db.Db();
  conn.conn = session.conn;
  return conn.countUnreadEntriesByFeed(id);
}

export function count_unread_entries(session) {
  const conn = new db.Db();
  conn.conn = session.conn;
  return conn.countUnreadEntries();
}

export async function create_entry(session, entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const id = await conn.createEntry(entry);
  session.channel.postMessage({type: 'entry-created', id: id});
  return id;
}

export async function create_feed(session, feed) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const id = await conn.createFeed(feed);
  session.channel.postMessage({type: 'feed-created', id: id});
  return id;
}

export async function create_feeds(session, feeds) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const ids = await conn.createFeeds(feeds);
  for (const id of ids) {
    session.channel.postMessage({type: 'feed-created', id: id});
  }
  return ids;
}

export async function delete_entry(session, id, reason) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.deleteEntry(id);
  session.channel.postMessage({type: 'entry-deleted', id: id, reason: reason});
}

export async function delete_feed(session, feed_id, reason) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const eids = await conn.deleteFeed(feed_id);
  session.channel.postMessage(
      {type: 'feed-deleted', id: feed_id, reason: reason});

  for (const id of eids) {
    session.channel.postMessage(
        {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
  }
}

export function get_entry(session, mode, value, key_only) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.getEntry(mode, value, key_only);
}

export function get_entries(session, mode, offset, limit) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.getEntries(mode, offset, limit);
}

export function get_feed_ids(session) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.getFeedIds();
}

export function get_feed(session, mode, value, key_only) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.getFeed(mode, value, key_only);
}

export function get_feeds(session, mode, title_sort) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.getFeeds(mode, title_sort);
}

export function iterate_entries(session, handle_entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.iterateEntries(handle_entry);
}

export async function mark_entry_read(session, id) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.markEntryRead(id);
  session.channel.postMessage({type: 'entry-read', id: id});
}

export function query_entries(session, query) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.queryEntries(query);
}

export async function update_entry(session, entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.updateEntry(entry);
  session.channel.postMessage({type: 'entry-updated', id: entry.id});
}

export async function update_feed(session, feed, overwrite) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.updateFeed(feed, overwrite);
  session.channel.postMessage(
      {type: 'feed-updated', id: feed.id, feed: overwrite ? undefined : feed});
}
