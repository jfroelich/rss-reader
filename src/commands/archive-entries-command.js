import archive_entries from '/src/db/ops/archive-entries.js';
import db_open from '/src/db/ops/open.js';

export default async function archive_entries_command() {
  console.log('Archiving entries...');

  const conn = await db_open();
  const channel = new BroadcastChannel('reader');
  const entry_ids = await archive_entries(conn, channel);
  conn.close();
  channel.close();

  console.debug('Archived %d entries', entry_ids.length);
}
