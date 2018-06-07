import {localstorage_read_int} from '/src/lib/localstorage-read-int.js';
import {get_entries} from '/src/reader-db.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';

export async function load_and_append_slides(conn, limit) {
  // TODO: if the default isn't available then default to unlimited by leaving
  // the value as NaN?
  const default_limit = localstorage_read_int('initial_entry_load_limit') || 3;
  if (typeof limit === 'undefined') {
    limit = default_limit;
  }
  const offset = count_unread_slides();

  const entries = await get_entries(conn, 'viewable', offset, limit);
  for (const entry of entries) {
    append_slide(entry);
  }

  // Return the number of appended entries
  return entries.length;
}
