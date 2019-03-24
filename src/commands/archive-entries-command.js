import archive_entries from '/src/db/ops/archive-entries.js';
import open from '/src/db/ops/open.js';

export default async function archive_entries_command() {
  console.log('Archiving entries...');
  const conn = await open();
  const entry_ids = await archive_entries(conn);
  conn.close();
  console.debug('Archived %d entries', entry_ids.length);
}
