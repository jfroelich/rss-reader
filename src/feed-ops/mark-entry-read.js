import * as badge from '/src/badge.js';
import * as rdb from '/src/rdb/rdb.js';

export default async function entry_mark_read(conn, channel, entry_id) {
  await rdb.rdb_entry_mark_read(conn, channel, entry_id);
  console.debug('Marked entry %d as read', entry_id);
  badge.update(conn).catch(console.error);
}
