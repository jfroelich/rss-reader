import * as db from '/src/db.js';
import {INDEFINITE} from '/src/deadline.js';

// clang-format off
export {
  append_entry_url,
  append_feed_url,
  construct_entry,
  construct_feed,
  entry_has_url,
  feed_get_url,
  feed_has_url,
  InvalidStateError,
  is_entry,
  is_feed,
  is_valid_entry_id,
  is_valid_feed_id,
  NotFoundError,
  sanitize_entry,
  sanitize_feed,
  validate_entry,
  validate_feed,
  ValidationError
} from '/src/db.js';

// clang-format on

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
  session.conn = await db.open(name, version, timeout);
  return session;
}

export async function archive_entries(session, max_age) {
  const ids = await db.archive_entries(session.conn, max_age);
  for (const id of ids) {
    session.channel.postMessage({type: 'entry-archived', id: id});
  }
}

export function count_unread_entries_by_feed(session, id) {
  return db.count_unread_entries_by_feed(session.conn, id);
}

export function count_unread_entries(session) {
  return db.count_unread_entries(session.conn);
}

export async function create_entry(session, entry) {
  const id = await db.create_entry(session.conn, entry);
  session.channel.postMessage({type: 'entry-created', id: id});
  return id;
}

export async function create_feed(session, feed) {
  const id = await db.create_feed(session.conn, feed);
  session.channel.postMessage({type: 'feed-created', id: id});
  return id;
}

export async function create_feeds(session, feeds) {
  const ids = await db.create_feeds(session.conn, feeds);
  for (const id of ids) {
    session.channel.postMessage({type: 'feed-created', id: id});
  }
  return ids;
}

export async function delete_entry(session, id, reason) {
  await db.delete_entry(session.conn, id);
  session.channel.postMessage({type: 'entry-deleted', id: id, reason: reason});
}

export async function delete_feed(session, feed_id, reason) {
  const eids = await db.delete_feed(session.conn, feed_id);
  session.channel.postMessage(
      {type: 'feed-deleted', id: feed_id, reason: reason});

  for (const id of eids) {
    session.channel.postMessage(
        {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
  }
}

export function get_entry(session, mode, value, key_only) {
  return db.get_entry(session.conn, mode, value, key_only);
}

export function get_entries(session, mode, offset, limit) {
  return db.get_entries(session.conn, mode, offset, limit);
}

export function get_feed_ids(session) {
  return db.get_feed_ids(session.conn);
}

export function get_feed(session, mode, value, key_only) {
  return db.get_feed(session.conn, mode, value, key_only);
}

export function get_feeds(session, mode, title_sort) {
  return db.get_feeds(session.conn, mode, title_sort);
}

export function iterate_entries(session, handle_entry) {
  return db.iterate_entries(session.conn, handle_entry);
}

export async function mark_entry_read(session, id) {
  await db.mark_entry_read(session.conn, id);
  session.channel.postMessage({type: 'entry-read', id: id});
}

export function query_entries(session, query) {
  return db.query_entries(session.conn, query);
}

export async function update_entry(session, entry) {
  await db.update_entry(session.conn, entry);
  session.channel.postMessage({type: 'entry-updated', id: entry.id});
}

export async function update_feed(session, feed, overwrite) {
  await db.update_feed(session.conn, feed, overwrite);
  session.channel.postMessage(
      {type: 'feed-updated', id: feed.id, feed: overwrite ? undefined : feed});
}
