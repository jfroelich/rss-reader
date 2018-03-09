import {rdb_entry_mark_read} from '/src/rdb/rdb.js';
import badge_update_text from '/src/update-badge-text.js';

export default async function entry_mark_read(conn, channel, entry_id) {
  await rdb_entry_mark_read(conn, channel, entry_id);
  console.debug('Marked entry %d as read', entry_id);
  badge_update_text(conn).catch(console.error);
}
