import * as db from '/src/db/db.js';
import * as ls from '/src/localstorage/localstorage.js';
import {append_slide} from './append-slide.js';
import {count_unread_slides} from './count-unread-slides.js';
import {mark_slide_read_start} from './mark-slide-read.js';
import {remove_slide} from './remove-slide.js';
import * as slideshow_state from './slideshow-state.js';

// TODO: this should not be interacting directly with local storage. This should
// be interacting with some kind of configuration module that abstracts away how
// configuration information is stored

export async function show_next_slide() {
  if (slideshow_state.get_active_transition_count()) {
    return;
  }

  const current_slide = slideshow_state.get_current_slide();
  if (!current_slide) {
    return;
  }

  const session = await db.open_with_channel();
  await mark_slide_read_start(session, current_slide);

  const slide_unread_count = count_unread_slides();
  let entries = [];
  if (slide_unread_count < 3) {
    const limit = ls.read_int('initial_entry_load_limit');
    const mode = 'viewable';
    entries = await db.get_entries(session, mode, slide_unread_count, limit);
  }
  session.close();

  for (const entry of entries) {
    if (!document.querySelector('slide[entry="' + entry.id + '"]')) {
      append_slide(entry);
    } else {
      console.debug('Entry already loaded', entry.id);
    }
  }

  const next_slide = current_slide.nextElementSibling;
  if (next_slide) {
    slideshow_state.increment_active_transition_count();
    current_slide.style.left = '-100%';
    next_slide.style.left = '0';
    slideshow_state.set_current_slide(next_slide);
  }

  if (entries.length) {
    compact_slides();
  }
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
  if (slideshow_state.get_active_transition_count()) {
    console.debug('Canceling previous navigation');
    return;
  }

  const current_slide = slideshow_state.get_current_slide();
  if (!current_slide) {
    return;
  }

  const previous_slide = current_slide.previousElementSibling;
  if (!previous_slide) {
    return;
  }

  slideshow_state.increment_active_transition_count();
  current_slide.style.left = '100%';
  previous_slide.style.left = '0';
  slideshow_state.set_current_slide(previous_slide);
}
