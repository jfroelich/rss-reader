import * as db from '/src/db.js';
import {localstorage_read_int} from '/src/lib/localstorage.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {mark_slide_read_start} from '/src/slideshow-page/mark-slide-read.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import * as slideshow_state from '/src/slideshow-page/slideshow-state.js';

export async function show_next_slide() {
  const current_slide = slideshow_state.get_current_slide();
  // There may not be a current slide (this is routine)
  // TODO: perhaps instead I only mark-read if current-slide, and still do
  // dynamic append and transition instead of exiting early here, to enable
  // transition away from no-slides-loaded screen via next-slide shortcut.
  if (!current_slide) {
    return;
  }

  // NOTE: the current slide contributes to the unread count
  let slide_unread_count = count_unread_slides();

  // TEMP: monitoring buggy functionality in console
  console.debug('Found %d unread slides before marking', slide_unread_count);

  const conn = await db.open_db();
  await mark_slide_read_start(conn, current_slide);

  let entries = [];
  if (slide_unread_count < 3) {
    console.debug('Maybe loading entries (unread %d)', slide_unread_count);
    entries = await load_entries(conn, slide_unread_count);
  }
  conn.close();

  // If we loaded some more entries, append them as slides. Do this prior to
  // transitioning to allow for dynamic loading.
  if (entries.length) {
    // TEMP: monitoring recent changes
    console.debug('Appending %d slides', entries.length);
    append_entries_as_slides(entries);
  }

  transition_next_slide();

  if (entries.length) {
    compact_slides();
  }
}

// Returns a promise
function load_entries(conn, offset) {
  // TODO: cleanup this "|| 3" crap
  const limit = localstorage_read_int('initial_entry_load_limit') || 3;
  const mode = 'viewable';
  return db.get_entries(conn, mode, offset, limit);
}

function compact_slides() {
  const current_slide = slideshow_state.get_current_slide();
  if (!current_slide) {
    return;
  }

  // The maximum number of slides loaded at any one time.
  // TODO: this should come from local storage
  const max_load_count = 6;
  const container = document.getElementById('slideshow-container');
  let first_slide = container.firstElementChild;
  while (container.childElementCount > max_load_count &&
         first_slide !== current_slide) {
    remove_slide(first_slide);
    first_slide = container.firstElementChild;
  }
}

function append_entries_as_slides(entries) {
  for (const entry of entries) {
    // TEMP: investigating sporadic error
    if (document.querySelector('slide[entry="' + entry.id + '"]')) {
      console.warn('Slide already loaded', entry.id);
    }

    append_slide(entry);
  }
}

function transition_next_slide() {
  if (slideshow_state.get_active_transition_count()) {
    return;
  }

  const current = slideshow_state.get_current_slide();
  if (!current) {
    return;
  }

  const next_slide = current.nextElementSibling;
  if (!next_slide) {
    return;
  }

  slideshow_state.increment_active_transition_count();
  current.style.left = '-100%';  // hide old
  next_slide.style.left = '0';   // show new
  slideshow_state.set_current_slide(next_slide);
}
