import * as db from '/src/db.js';
import {INDEFINITE} from '/src/deadline.js';

// clang-format off
export {
  Entry,
  Feed,
  InvalidStateError,
  is_entry,
  is_feed,
  NotFoundError,
  ValidationError
} from '/src/db.js';
// clang-format on

/*class CDB {
  constructor() {
    this.db = undefined;
  }

  open() {
    await this.db.open();
  }
}*/


// Temporary helpers due to db.js refactor as object
export function validate_feed(feed) {
  const conn = new db.Db();
  return conn.validate_feed(feed);
}

export function validate_entry(entry) {
  const conn = new db.Db();
  return conn.validate_entry(entry);
}

export function sanitize_feed(feed) {
  const conn = new db.Db();
  return conn.sanitize_feed(feed);
}

export function sanitize_entry(entry) {
  const conn = new db.Db();
  return conn.sanitize_entry(entry);
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

  const ids = await conn.archive_entries(max_age);
  for (const id of ids) {
    session.channel.postMessage({type: 'entry-archived', id: id});
  }
}

export function count_unread_entries_by_feed(session, id) {
  const conn = new db.Db();
  conn.conn = session.conn;
  return conn.count_unread_entries_by_feed(id);
}

export function count_unread_entries(session) {
  const conn = new db.Db();
  conn.conn = session.conn;
  return conn.count_unread_entries();
}

export async function create_entry(session, entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const id = await conn.create_entry(entry);
  session.channel.postMessage({type: 'entry-created', id: id});
  return id;
}

export async function create_feed(session, feed) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const id = await conn.create_feed(feed);
  session.channel.postMessage({type: 'feed-created', id: id});
  return id;
}

export async function create_feeds(session, feeds) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const ids = await conn.create_feeds(feeds);
  for (const id of ids) {
    session.channel.postMessage({type: 'feed-created', id: id});
  }
  return ids;
}

export async function delete_entry(session, id, reason) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.delete_entry(id);
  session.channel.postMessage({type: 'entry-deleted', id: id, reason: reason});
}

export async function delete_feed(session, feed_id, reason) {
  const conn = new db.Db();
  conn.conn = session.conn;

  const eids = await conn.delete_feed(feed_id);
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

  return conn.get_entry(mode, value, key_only);
}

export function get_entries(session, mode, offset, limit) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.get_entries(mode, offset, limit);
}

export function get_feed_ids(session) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.get_feed_ids();
}

export function get_feed(session, mode, value, key_only) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.get_feed(mode, value, key_only);
}

export function get_feeds(session, mode, title_sort) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.get_feeds(mode, title_sort);
}

export function iterate_entries(session, handle_entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.iterate_entries(handle_entry);
}

export async function mark_entry_read(session, id) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.mark_entry_read(id);
  session.channel.postMessage({type: 'entry-read', id: id});
}

export function query_entries(session, query) {
  const conn = new db.Db();
  conn.conn = session.conn;

  return conn.query_entries(query);
}

export async function update_entry(session, entry) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.update_entry(entry);
  session.channel.postMessage({type: 'entry-updated', id: entry.id});
}

export async function update_feed(session, feed, overwrite) {
  const conn = new db.Db();
  conn.conn = session.conn;

  await conn.update_feed(feed, overwrite);
  session.channel.postMessage(
      {type: 'feed-updated', id: feed.id, feed: overwrite ? undefined : feed});
}
