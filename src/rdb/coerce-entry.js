import * as rdb from '/src/rdb/rdb.js';

// Reformat a parsed entry as a storable entry
export function coerce_entry(parsed_entry) {
  const blank_storable_entry = rdb.rdb_entry_create();
  const storable_entry = Object.assign(blank_storable_entry, parsed_entry);

  // Translate link into head url
  delete storable_entry.link;
  if (parsed_entry.link) {
    try {
      rdb.rdb_entry_append_url(storable_entry, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return storable_entry;
}
