import {db_open} from '/src/db/db-open.js';
import {count_slides} from '/src/slideshow-page/count-slides.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {load_and_append_slides} from '/src/slideshow-page/load-and-append-slides.js';
import {mark_slide_read} from '/src/slideshow-page/mark-slide-read.js';
import {slide_onclick} from '/src/slideshow-page/slide-onclick.js';
import {get_current_slide} from '/src/slideshow-page/slideshow-state.js';
import {next, remove as remove_slide, slide_get_first} from '/src/slideshow-page/slideshow.js';

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
// Sharing the connection between mark as read and
// load_and_append_slides made sense at first but I do not like the
// large try/catch block. Also I think the two can be unlinked because they do
// not have to co-occur. Also I don't like how it has to wait for read to
// complete.

// TODO: view should not interact directly with db

// TODO: max_load_count should come from somewhere else like config
const max_load_count = 6;


export async function show_next_slide() {
  const current_slide = get_current_slide();
  const slide_unread_count = count_unread_slides();

  // TODO: I no longer understand this condition, it seems redundant

  if (slide_unread_count > 1) {
    const conn = await db_open();
    await mark_slide_read(conn, current_slide);
    conn.close();
    next();
    return;
  }

  let append_count = 0;
  const conn = await db_open();

  if (slide_unread_count < 2) {
    append_count = await load_and_append_slides(conn);
  }

  next();
  await mark_slide_read(conn, current_slide);
  conn.close();

  if (append_count < 1) {
    return;
  }

  let first_slide = slide_get_first();
  while (count_slides() > max_load_count && first_slide !== current_slide) {
    remove_slide(first_slide);
    first_slide.removeEventListener('click', slide_onclick);
    first_slide = slide_get_first();
  }
}
