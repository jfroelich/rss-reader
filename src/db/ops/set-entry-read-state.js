import Entry from '/src/db/entry.js';
import patch_entry from '/src/db/ops/patch-entry.js';

// TODO: deprecate? seems too simple now.

// Set an entry in the database as read or unread
export default function set_entry_read_state(conn, id, read = false) {
  return patch_entry(conn, {
    id: id,
    read_state: read ? Entry.READ : Entry.UNREAD,
    read_date: new Date()
  });
}
