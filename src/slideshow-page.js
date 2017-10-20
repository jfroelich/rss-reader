'use strict';

(function(exports){

const SLIDESHOW_DEBUG = false;

let current_slide_element = null;

const settings_channel = new BroadcastChannel('settings');
settings_channel.onmessage = function settings_channel_onmessage(event) {
  if(event.data === 'changed')
    entry_css_on_change(event);
};

const db_channel = new BroadcastChannel('db');
db_channel.onmessage = function db_channel_onmessage(event) {
  if(event.data && event.data.type === 'entryArchived')
    console.log('Received archive entry request message');
  else if(event.data && event.data.type === 'entryDeleted')
    console.log('Received entry delete request message');
};

const poll_channel = new BroadcastChannel('poll');
poll_channel.onmessage = function poll_channel_onmessage(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = count_unread_slides();
    let conn; // leave undefined
    if(count < 2)
      append_slides(conn);
  }
};

function slide_remove(slide_element) {
  slide_element.removeEventListener('click', slide_on_click);
  slide_element.remove();
}

// TODO: visual feedback in event of an error?
async function slide_mark_read(conn, slide_element) {
  // This is normal and not an error
  if(slide_element.hasAttribute('read'))
    return;

  const entry_id_string = slide_element.getAttribute('entry');
  const radix = 10;
  const entry_id_number = parseInt(entry_id_string, radix);
  let is_local_conn = false;
  try {
    if(!conn) {
      conn = await reader_db_open();
      is_local_conn = true;
    }

    const status = await entry_mark_read(conn, entry_id_number);
    if(status !== STATUS_OK) {
      // TODO: react to error
      if(SLIDESHOW_DEBUG)
        DEBUG('Failed to mark entry as read');
    } else {
      if(SLIDESHOW_DEBUG)
        DEBUG('Marked as read');
    }

    slide_element.setAttribute('read', '');
  } catch(error) {
    // TODO: handle error
    if(SLIDESHOW_DEBUG)
      DEBUG(error);
  } finally {
    if(is_local_conn && conn)
      conn.close();
  }
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function append_slides(conn) {
  const limit = 3;
  let is_local_conn = false;
  let entries = [];

  const offset = count_unread_slides();

  try {
    if(!conn) {
      conn = await reader_db_open();
      is_local_conn = true;
    }

    entries = await reader_db_get_unarchived_unread_entries(conn, offset,
      limit);
  } catch(error) {
    if(SLIDESHOW_DEBUG)
      DEBUG(error);
  } finally {
    if(is_local_conn && conn)
      conn.close();
  }

  for(const entry of entries)
    append_slide(entry);
  return entries.length;
}

// Add a new slide to the view.
function append_slide(entry) {
  const container_element = document.getElementById('slideshow-container');
  const slide_element = document.createElement('div');

  // tabindex must be explicitly defined for div.focus()
  slide_element.setAttribute('tabindex', '-1');
  slide_element.setAttribute('entry', entry.id);
  slide_element.setAttribute('feed', entry.feed);
  slide_element.setAttribute('class','entry');
  slide_element.addEventListener('click', slide_on_click);
  // Bind to slide, not window, because only slide scrolls
  // TODO: look into the new 'passive' flag for scroll listeners
  slide_element.addEventListener('scroll', slide_on_scroll);
  slide_element.style.position = 'absolute';

  if(container_element.childElementCount) {
    slide_element.style.left = '100%';
    slide_element.style.right = '-100%';
  } else {
    slide_element.style.left = '0%';
    slide_element.style.right = '0%';
  }

  slide_element.style.overflowX = 'hidden';
  slide_element.style.top = '0';
  slide_element.style.bottom = '0';
  slide_element.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title_element = create_article_title_element(entry);
  slide_element.appendChild(title_element);
  const content_element = create_article_content_element(entry);
  slide_element.appendChild(content_element);
  const source_element = create_feed_source_element(entry);
  slide_element.appendChild(source_element);

  container_element.appendChild(slide_element);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure current_slide_element is always set. Where do I do this?
  if(container_element.childElementCount === 1) {
    current_slide_element = slide_element;
    current_slide_element.focus();
  }
}

function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', entry_get_top_url(entry));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('target','_blank');
  title_element.setAttribute('rel', 'noreferrer');
  title_element.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    title_element.setAttribute('title', entry.title);
    let titleText = entry.title;
    titleText = article_title_filter_publisher(titleText);
    titleText = html_truncate(titleText, 300);
    title_element.innerHTML = titleText;
  } else {
    title_element.setAttribute('title', 'Untitled');
    title_element.textContent = 'Untitled';
  }

  return title_element;
}

function create_article_content_element(entry) {
  const content_element = document.createElement('span');
  content_element.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  content_element.innerHTML = entry.content;
  return content_element;
}

function create_feed_source_element(entry) {
  const source_element = document.createElement('span');
  source_element.setAttribute('class','entrysource');

  if(entry.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', entry.faviconURLString);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    source_element.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  if(entry.feedLink)
    title_element.setAttribute('title', entry.feedLink);

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(date_format(entry.datePublished));
  }
  title_element.textContent = buffer.join('');
  source_element.appendChild(title_element);

  return source_element;
}

function slide_on_click(event) {
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if(event.which !== LEFT_MOUSE_BUTTON_CODE)
    return true;
  const anchor = event.target.closest('a');
  if(!anchor)
    return true;
  if(!anchor.hasAttribute('href'))
    return true;

  event.preventDefault();

  const url_string = anchor.getAttribute('href');
  chrome.tabs.create({'active': true, 'url': url_string});

  let conn;// undefined
  slide_mark_read(conn, current_slide_element).catch(console.warn);

  return false;
}

// TODO: visual feedback on error
async function show_next_slide() {

  // current_slide_element may be undefined
  // This isn't actually an error. For example, when initially viewing the
  // slideshow before subscribing when there are no feeds and entries, or
  // initially viewing the slideshow when all entries are read.
  if(!current_slide_element) {
    console.warn('No current slide');
    return;
  }

  const old_slide_element = current_slide_element;
  const unread_slide_element_count = count_unread_slides();
  let num_slides_appended = 0;
  let conn;

  try {
    conn = await reader_db_open();

    // Conditionally append more slides
    if(unread_slide_element_count < 2)
      num_slides_appended = await append_slides(conn);

    if(current_slide_element.nextSibling) {
      current_slide_element.style.left = '-100%';
      current_slide_element.style.right = '100%';
      current_slide_element.nextSibling.style.left = '0px';
      current_slide_element.nextSibling.style.right = '0px';
      current_slide_element.scrollTop = 0;
      current_slide_element = current_slide_element.nextSibling;

      // Change the active element to the new current slide, so that scrolling
      // with keys works
      current_slide_element.focus();

      // Must be awaited
      await slide_mark_read(conn, old_slide_element);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(num_slides_appended > 0)
    cleanup_slideshow_on_append();
}

function cleanup_slideshow_on_append() {
  // Weakly assert as this is trivial
  console.assert(current_slide_element, 'current_slide_element is undefined');

  const max_slide_count = 6;
  const container_element = document.getElementById('slideshow-container');
  while(container_element.childElementCount > max_slide_count &&
    container_element.firstChild !== current_slide_element)
    slide_remove(container_element.firstChild);
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function show_prev_slide() {
  if(!current_slide_element)
    return;
  const prev_slide_element = current_slide_element.previousSibling;
  if(!prev_slide_element)
    return;
  current_slide_element.style.left = '100%';
  current_slide_element.style.right = '-100%';
  prev_slide_element.style.left = '0px';
  prev_slide_element.style.right = '0px';
  current_slide_element = prev_slide_element;
  // Change the active element to the new current slide, so that scrolling
  // using keyboard keys still works
  current_slide_element.focus();
}

function count_unread_slides() {
  const unread_slides =
    document.body.querySelectorAll('div[entry]:not([read])');
  return unread_slides.length;
}

let keydown_timer = null;
window.addEventListener('keydown', function on_key_down(event) {
  // Redefine space from page down to navigate next
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  if(code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    cancelIdleCallback(keydown_timer);
    keydown_timer = requestIdleCallback(show_next_slide);
  } else if(code === LEFT || code === P) {
    event.preventDefault();
    cancelIdleCallback(keydown_timer);
    keydown_timer = requestIdleCallback(show_prev_slide);
  }
});

// Override built in keyboard scrolling
let scroll_callback_handle;
function slide_on_scroll(event) {
  const DOWN = 40, UP = 38;
  function on_idle_callback() {
    const delta = event.keyCode === UP ? -200 : 200;
    document.activeElement.scrollTop += delta;
  }

  if(event.keyCode !== DOWN && event.keyCode !== UP)
    return;
  if(!document.activeElement)
    return;
  event.preventDefault();
  cancelIdleCallback(scroll_callback_handle);
  scroll_callback_handle = requestIdleCallback(on_idle_callback);
}

function on_dom_content_loaded(event) {
  entry_css_init();
  let conn;// leave as undefined
  append_slides(conn).catch(console.warn);
}

document.addEventListener('DOMContentLoaded', on_dom_content_loaded,
  {'once': true});

}(this));

/*
# TODO

* decouple loading of additional content with navigation. It causes
lag. Instead, create a queue of articles, and refill it periodically on
some type of schedule (using setInterval or a re-setTimeout-per-append)
Only append during navigation if the queue has not yet refilled.
TODO: if advancing to next article too quickly, some articles are loaded
that were already loaded, leading to duplicate articles. The call to append
articles needs to be delayed until scrolling completes or something like
that. Actually I think it is because the mark-read is on a diff 'thread'
than the update code. The append needs to wait for mark read to complete.
* figure out why markAsRead cannot just remove the read attribute, I would
prefer to remove it instead of set it to empty. for some reason if i remove it
this causes some type of bug.
* instead of using chrome message listener, i'd like to figure out the
post message api. it is cross platform and lower level and seems like an
interesting challenge.
* react to entryDeleteRequestedByUnsubscribe message sent from
sub_remove
* react to entry archive message sent from ArchiveService
* the unsubscribe event was deprecated, why do i even have onUnsubscribe? it
is never called. maybe i should just remove it
* in onUnsubscribe, verify that I removing all listeners when removing the
slide, or have the removeSlide function do it
* in onUnsubscribe, stop using reduce. Just use a for..of loop
- in onUnsubscribe, I still need to implement how the UI updates if the slide
currently shown was removed.

* TODO: enable swipe left and right for navigation

# Notes on broadcast channels

Should poll channel really be distinct from db? Not so sure anymore.
Maybe I just want to use a general "extension" channel that handles all
extension related messages? Perhaps the only major qualifying characteristic
is the persistence of listening for messages for the lifetime of the page,
and organizing the logic according to the content of the response is done
with the conditions within the listener. There are different message
frequencies so some conditions are rarely true which means some wasted
checks, but on the other hand there are less channels. Would it be simpler,
and would the added simplicity outweight any performance benefit/cost, or
is there not even really much of a perf cost.

# Notes on append_slides

* can use querySelector to get the first slide itself
instead of getting the parent container and checking its children. we do not
actually need a count here, just a check of whether firstElementChild is
defined.
* think more about what to do on database connection failure

# Notes on slide click events

* just checking if image parent is in anchor is incorrect
The correct condition is if image is a descendant of an anchor, use
closest instead of parentNode
* this should probably be the handler that determines
whether to open an anchor click in a new tab, instead of
setting a target attribute per anchor.
* event.target is what was clicked. event.currentTarget is where the
listener is attached.
* define event.target using a variable. What does it mean. Does it
mean the dom object to which the listener is attached? Or does it
mean the element that was clicked on? etc.
* bug, when clicking on an image in a link, it is still a link
click that should open the link in a new window...
* this should be checking if in anchor axis, not just immediate parent

# Notes on append_slide

* use <article> instead of div
* in the current design, fetched content scrubbing is done onLoad
instead of onBeforeStore. This is not the best performance. This is done
primarily to simplify development. However, it also means we can defer
decisions about rendering, which provides a chance to customize the
rendering for already stored content and not just content fetched in the
future. It also emphasizes that scrubbing must be tuned to be fast enough
not to cause lag while blocking, because this is synchronous.
* rename title variable
* use better variable names in this function
* use section instead of span for article content section

# Notes on key down event

* event.target is body
* event.currentTarget is window
* Handle key presses. Although I would prefer the browser managed the scroll
response, there is a strange issue with scrolling down on an article moved
into view if I do not explicitly handle it here because it is an inner
element that does not I think have focus, so the down arrow otherwise has no
effect.
* maybe I should always be clearing both keydown timers? I need to
test more when spamming left right
* is there a builtin enum of key code names that i could use instead of my
own custom list?
* instead of binding onKeyDown to window, bind to each slide? That way
we don't have to use a global tracking variable like Slideshow.currentSlide,
which feels hackish.

# Notes on scrollToY

* i do not love the innards of this function, make this easier to read

# Notes on filtering article titles

This function attempts to filter publisher information from an article's title.
The input data generally looks like 'Article Title - Delimiter - Publisher'.
The basic approach involves looking for an end delimiter, and if one is
found, checking the approximate number of words following the delimiter,
and if the number is less than a given threshold, returning a new string
without the final delimiter or any of the words following it. This uses the
threshold condition to reduce the chance of confusing the title with the
the publisher in the case that there is an early delimiter, based on the
assumption that the title is usually longer than the pubisher, or rather,
that the publisher's name is generally short.

There are probably some great enhancements that could be done, such as not
truncating in the event the resulting title would be too short, as in, the
the resulting title would not contain enough words. We could also consider
comparing the number of words preceding the final delimiter to the number
of words trailing the final delimiter. I could also consider trying to
remove the publisher when it is present as a prefix, but this seems to be
less frequent.

*/
