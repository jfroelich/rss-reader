import * as db from '/src/db/db.js';
import {mark_slide_read_start} from '/src/slideshow-page/mark-slide-read.js';
import {get_current_slide} from '/src/slideshow-page/slideshow-state.js';

export async function slide_onclick(event) {
  // Only intercept left clicks
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  // Only intercept clicks on or within an anchor element. Note that closest
  // checks not only ancestors but also the element itself.
  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  // Only intercept if the anchor has an href
  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return;
  }

  // Begin intercept. Cancel the normal click reaction
  event.preventDefault();

  // Open the link in a new tab via a technique that Chrome tolerates
  chrome.tabs.create({active: true, url: url_string});


  // Find the clicked slide. Start from parent because we know that the anchor
  // itself is not a slide. We know that a slide will always be found
  const slide = anchor.parentNode.closest('slide');

  // If the click was on the article title, mark as read always. If not then
  // it depends on whether url is similar.
  if (!anchor.matches('.entry-title')) {
    const entry_url = find_slide_url(slide);
    if (entry_url) {
      let clicked_url;
      try {
        clicked_url = new URL(url_string);
      } catch (error) {
        // if there is a problem with the url itself, no point in trying to
        // mark as read
        console.warn(error);
        return;
      }

      if (clicked_url) {
        // If the click was on a link that does not look like it points to the
        // article, then do not mark as read
        if (!are_similar_urls(entry_url, clicked_url)) {
          return;
        }
      }
    }
  }

  // Mark the clicked slide as read. While these conditions are redundant with
  // the checks within mark_slide_read_start, it avoids opening the connection.
  if (!slide.hasAttribute('stale') && !slide.hasAttribute('read') &&
      !slide.hasAttribute('read-pending')) {
    const session = await db.open_with_channel();
    await mark_slide_read_start(session, slide);
    session.close();
  }
}

// Return whether both urls point to the same entry
// TODO: make this stricter. This should be checking path
function are_similar_urls(entry_url, clicked_url) {
  return entry_url.origin === clicked_url.origin;
}

// Find the entry url of the slide. This is a hackish solution to the problem
// that for each anchor clicked I need to be able to compare it to the url of
// the article containing the anchor, but the view doesn't provide this
// information upfront, so we have to go and find it again. Given that we are in
// a forked event handler, fortunately, performance is less concerning. In fact
// it is feels better to defer this cost until now, rather than some upfront
// cost like storing the href as a slide attribute or per anchor or calculating
// some upfront per-anchor attribute as an apriori signal.
function find_slide_url(slide) {
  const title_anchor = slide.querySelector('a.entry-title');
  // Should never happen. I suppose it might depend on how a slide without a
  // url is constructed in html. We cannot rely on those other implementations
  // here because we pretend not to know how those implementations work.
  if (!title_anchor) {
    return;
  }

  const entry_url = title_anchor.getAttribute('href');
  // Can happen, as the view makes no assumptions about whether articles have
  // urls (only the model imposes that constraint)
  if (!entry_url) {
    return;
  }

  let entry_url_object;
  try {
    entry_url_object = new URL(entry_url);
  } catch (error) {
    // If there is an entry title with an href value, it should pretty much
    // always be valid. But we are in a context where we cannot throw the error
    // or deal with it, so we just log as a non-fatal but significant error.
    console.warn(error);
  }

  return entry_url_object;
}
