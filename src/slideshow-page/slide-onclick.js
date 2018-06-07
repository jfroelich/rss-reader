import {open_feed_db} from '/src/db/open-feed-db.js';
import {mark_slide_read} from '/src/slideshow-page/mark-slide-read.js';
import {get_current_slide} from '/src/slideshow-page/slideshow-state.js';

export async function slide_onclick(event) {
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  if (!anchor.hasAttribute('href')) {
    return true;
  }

  event.preventDefault();

  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return;
  }

  open_tab(url_string);

  const clicked_slide = anchor.parentNode.closest('slide');
  if (!clicked_slide) {
    return;
  }

  const current_slide = get_current_slide();

  if (clicked_slide.hasAttribute('stale')) {
    return false;
  }

  const conn = await open_feed_db();
  await mark_slide_read(conn, clicked_slide);
  conn.close();
}

function open_tab(url_string) {
  chrome.tabs.create({active: true, url: url_string});
}
