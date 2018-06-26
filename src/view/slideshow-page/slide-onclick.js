import ModelAccess from '/src/model/model-access.js';
import {mark_slide_read_start} from '/src/view/slideshow-page/mark-slide-read.js';
import {get_current_slide} from '/src/view/slideshow-page/slideshow-state.js';

export async function slide_onclick(event) {
  // Only intercept left clicks
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  // Only intercept clicks on or within an anchor element
  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  // Only intercept if the anchor has an href
  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return true;
  }

  // Begin intercept. Cancel the normal click reaction
  event.preventDefault();

  // Open the link in a new tab via a technique that Chrome tolerates
  chrome.tabs.create({active: true, url: url_string});

  // Find the clicked slide. Start from parent because we know that the anchor
  // itself is not a slide
  const slide = anchor.parentNode.closest('slide');

  // Mark the clicked slide as read. While these conditions are redundant with
  // the checks within mark_slide_read_start, it avoids opening the connection.
  if (!slide.hasAttribute('stale') && !slide.hasAttribute('read') &&
      !slide.hasAttribute('read-pending')) {
    const dal = new ModelAccess();
    await dal.connect();
    await mark_slide_read_start(dal.conn, slide);
    dal.close();
  }
}
