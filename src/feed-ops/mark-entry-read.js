import {mark_entry_read} from '/src/app/operations/mark-entry-read.js';
import * as badge from '/src/badge.js';
import * as rdb from '/src/rdb/rdb.js';

// TODO: now that mark_entry_read exists as an operation there is no longer a
// need for this extra layer in feed-ops. Deprecate this, move badge update call
// into operation, and update callers to use the operation directly instead of
// this

export default async function entry_mark_read(conn, channel, entry_id) {
  await mark_entry_read(conn, channel, entry_id);
  console.debug('Marked entry %d as read', entry_id);
  badge.update(conn).catch(console.error);
}
