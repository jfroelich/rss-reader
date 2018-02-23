import {rdb_entry_append_url, rdb_entry_create, rdb_entry_has_url} from '/src/rdb/rdb.js';

// Reformats a parsed feed entry as a storable entry
// @param parsed_entry {Object} an entry object such as that produced by
// feed_parse.
// @throws {Error} if parsed_entry is not an object
// @return {Object} an entry object in rdb format
export function coerce_entry(parsed_entry) {
  const blank_storable_entry = rdb_entry_create();
  const storable_entry = Object.assign(blank_storable_entry, parsed_entry);
  delete storable_entry.link;

  if (parsed_entry.link) {
    try {
      rdb_entry_append_url(storable_entry, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return storable_entry;
}
