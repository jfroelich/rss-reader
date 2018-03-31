import {entry_is_valid_id} from '/src/objects/entry.js';
import {find_entry_id_by_url} from '/src/operations/find-entry-id-by-url.js';

// TODO: deprecate entirely, the caller should use find_entry_id_by_url

export async function contains_entry_with_url(conn, url) {
  const entry_id = await find_entry_id_by_url(conn, url);
  return entry_is_valid_id(entry_id);
}
