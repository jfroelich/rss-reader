import {db_get_entries} from '/src/db/db-get-entries.js';
import {localstorage_read_int} from '/src/lib/localstorage-read-int.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';

// TODO: break this up. I named it verb-and-verb to highlight how it is poorly
// designed.
// TODO: append slides shouldn't be responsible for loading. This should accept
// an array of slides as input. Something else should be doing loading.

export async function load_and_append_slides(conn, limit) {
  // TODO: if the default isn't available then default to unlimited by leaving
  // the value as NaN?
  const default_limit = localstorage_read_int('initial_entry_load_limit') || 3;

  const options = {};
  options.limit = limit ? limit : default_limit;
  options.offset = count_unread_slides();
  options.mode = 'viewable';

  const entries = await db_get_entries(conn, options);

  for (const entry of entries) {
    append_slide(entry);
  }

  // Return the number of appended entries
  return entries.length;
}
