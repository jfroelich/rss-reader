async function remove_entries_missing_urls() {
  'use strict';
  const channel = new BroadcastChannel('db');
  let count = 0;
  let conn;
  try {
    conn = await reader_db_open();
    const invalid_entries = await reader_db_find_entries_missing_urls(conn);
    const entry_ids = [];
    for(const entry of invalid_entries)
      entry_ids.push(entry.id);
    count = entry_ids.length;
    await reader_db_remove_entries(conn, entry_ids, channel);
  } finally {
    if(conn)
      conn.close();
    channel.close();
  }
  return count;
}
