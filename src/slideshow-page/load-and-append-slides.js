import {db_find_viewable_entries} from '/src/db/db-find-viewable-entries.js';
import {log} from '/src/log.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';

// TODO: this is currently broken, missing append_slide import

// TODO: append slides shouldn't be responsible for loading. This should accept
// an array of slides as input. Something else should be doing loading.

// TODO: limit value should come from somewhere else instead of being hardcoded,
// such as configuration

// TODO: remove logging once this works

// TODO: the view should not be directly interacting with the database?

export async function load_and_append_slides(conn, limit) {
  limit = typeof limit === 'undefined' ? 3 : limit;
  log('Appending slides (limit: %d)', limit);

  const offset = count_unread_slides();
  const entries = await db_find_viewable_entries(conn, offset, limit);

  for (const entry of entries) {
    append_slide(entry);
  }

  return entries.length;
}
