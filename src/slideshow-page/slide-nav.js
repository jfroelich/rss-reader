import * as db from '/src/db.js';
import * as localstorage from '/src/lib/localstorage.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {mark_slide_read_start} from '/src/slideshow-page/mark-slide-read.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import * as slideshow_state from '/src/slideshow-page/slideshow-state.js';

export async function show_next_slide() {
  const current_slide = slideshow_state.get_current_slide();
  // There may not be a current slide (this is routine)
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

  // TODO: this condition needs some tweaking to reflect the new offset
  // calculation. The current behavior is harmless, but I would rather not even
  // try to load entries. basically this condition should consider read-pending
  // along with read. slide_unread_count only considers read at the moment.
  // TODO: furthermore, it may be just that slide_unread_count should be
  // considering read-pending, or that I should use some separate function that
  // makes it clear it considers both states. There is no other use of
  // slide_unread_count in this function so it kind of makes sense. I would not
  // need a separate offset calculation here either.
  if (slide_unread_count < 3) {
    const selector = 'slide:not([read]):not([read-pending])';
    const slides = document.body.querySelectorAll(selector);
    const offset = slides.length;

    // TEMP: monitoring new offset calculation
    console.debug(
        'Maybe loading entries, offset %d, unread %d', offset,
        slide_unread_count);

    entries = await load_entries(conn, offset);
  }
  conn.close();

  // If we loaded some more entries, append them as slides. Do this prior to
  // transitioning to allow for dynamic loading.
  // TODO: if things work, this condition isn't needed, as the loop noops
  if (entries.length) {
    // TEMP: monitoring recent changes
    console.debug('Appending %d slides', entries.length);
    for (const entry of entries) {
      // TEMP: investigating sporadic error. This condition should not be needed
      // but it occassionally is at the moment. Although I may have fixed it
      // with changes to offset calculation above.
      if (document.querySelector('slide[entry="' + entry.id + '"]')) {
        console.warn('Entry already loaded, not appending again', entry.id);
        continue;
      }

      append_slide(entry);
    }
  }

  if (!slideshow_state.get_active_transition_count()) {
    const next_slide = current_slide.nextElementSibling;
    if (next_slide) {
      slideshow_state.increment_active_transition_count();
      current_slide.style.left = '-100%';  // hide old
      slideshow_state.increment_active_transition_count();
      next_slide.style.left = '0';  // show new
      slideshow_state.set_current_slide(next_slide);
    }
  }

  if (entries.length) {
    compact_slides();
  }
}

// Returns a promise
function load_entries(conn, offset) {
  // TODO: cleanup this "|| 3" crap
  const limit = localstorage.read_int('initial_entry_load_limit') || 3;
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

export function show_prev_slide() {
  if (slideshow_state.get_active_transition_count() > 0) {
    console.debug('Canceling previous navigation, too many transitions');
    return;
  }

  if (!slideshow_state.get_current_slide()) {
    return;
  }

  const previous_slide =
      slideshow_state.get_current_slide().previousElementSibling;
  if (!previous_slide) {
    return;
  }

  slideshow_state.increment_active_transition_count();
  slideshow_state.get_current_slide().style.left = '100%';

  // TEMP: testing proper transition count
  slideshow_state.increment_active_transition_count();

  previous_slide.style.left = '0';
  slideshow_state.set_current_slide(previous_slide);
}
