import {open_feed_db} from '/src/db/open-feed-db.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {load_and_append_slides} from '/src/slideshow-page/load-and-append-slides.js';
import {mark_slide_read} from '/src/slideshow-page/mark-slide-read.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import {get_active_transition_count, get_current_slide, increment_active_transition_count, set_current_slide} from '/src/slideshow-page/slideshow-state.js';

// TODO: I should probably unlink loading on demand and navigation, because this
// causes lag. navigation would be smoother if I appended even earlier, like
// before even reaching the situation of its the last slide and there are no
// more so append. It would be better if I did something like check the number
// of remaining unread slides, and if that is less than some number, append
// more. And it would be better if I did that before even navigating. However
// that would cause lag. So it would be even better if I started in a separate
// microtask an append operation and then continued in the current task. Or, the
// check should happen not on append, but after doing the navigation. Or after
// marking the slide as read.

// TODO: sharing the connection between mark as read and
// load_and_append_slides made sense at first but I do not like the
// large try/catch block. Also I think the two can be unlinked because they do
// not have to co-occur. Also I don't like how it has to wait for read to
// complete.


// TODO: max_load_count should come from somewhere else like config or
// local storage
const max_load_count = 6;


export async function show_next_slide() {
  const current_slide = get_current_slide();
  const slide_unread_count = count_unread_slides();

  // TODO: I no longer understand this condition, it seems redundant

  if (slide_unread_count > 1) {
    const conn = await open_feed_db();
    await mark_slide_read(conn, current_slide);
    conn.close();
    next();
    return;
  }

  let append_count = 0;
  const conn = await open_feed_db();

  if (slide_unread_count < 2) {
    append_count = await load_and_append_slides(conn);
  }

  next();
  await mark_slide_read(conn, current_slide);
  conn.close();

  if (append_count < 1) {
    return;
  }

  const container = document.getElementById('slideshow-container');

  let first_slide = container.firstElementChild;
  while (container.childElementCount > max_load_count &&
         first_slide !== current_slide) {
    remove_slide(first_slide);
    first_slide = container.firstElementChild;
  }
}

function next() {
  if (get_active_transition_count() > 0) {
    return false;
  }

  if (!get_current_slide()) {
    return false;
  }

  const next_slide = get_current_slide().nextElementSibling;
  if (!next_slide) {
    return false;
  }

  increment_active_transition_count();
  get_current_slide().style.left = '-100%';

  // NOTE: in process of creating this lib I noticed the source of the strange
  // behavior with why count is only 1 despite two transitions, it was here
  // because I forgot to increment again. But it is working like I want so I am
  // hesitant to change it at the moment. Not a bug, but a feature. Ew.
  // active_transition_count++;

  next_slide.style.left = '0';
  set_current_slide(next_slide);

  return true;
}
