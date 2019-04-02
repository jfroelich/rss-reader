import get_entries from '/src/db/ops/get-entries.js';
import patch_entry from '/src/db/ops/patch-entry.js';
import assert from '/src/lib/assert.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default async function archive_entries(conn, max_age = TWO_DAYS_MS) {
  assert(max_age >= 0);

  const buffer_size = 100;
  let offset = 0;
  const current_date = new Date();
  let entries = await get_entries(conn, 'archivable', offset, buffer_size);

  while (entries.length) {
    for (const entry of entries) {
      if (entry.created_date && (current_date - entry.created_date > max_age)) {
        const delta_transitions = {
          id: entry.id,
          title: undefined,
          author: undefined,
          enclosure: undefined,
          'content': undefined,
          favicon_url: undefined,
          feed_title: undefined,
          archive_state: 1
        };
        await patch_entry(conn, delta_transitions);
      }
    }

    // Only load more if we read up to the limit last time
    if (entries.length === buffer_size) {
      offset += buffer_size;
      entries = await get_entries(conn, 'archivable', offset, buffer_size);
    } else {
      entries = [];
    }
  }
}
