import {entry_append_url, entry_create} from '/src/app/objects/entry.js';
import * as rdb from '/src/rdb/rdb.js';

// Reformat a parsed entry as a storable entry
export function coerce_entry(parsed_entry) {
  const blank_entry = entry_create();
  const storable_entry = Object.assign(blank_entry, parsed_entry);

  delete storable_entry.link;
  if (parsed_entry.link) {
    try {
      entry_append_url(storable_entry, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return storable_entry;
}
