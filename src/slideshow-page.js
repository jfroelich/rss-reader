'use strict';

// import base/indexeddb.js
// import article-title.js
// import entry-css.js
// import entry-mark-read.js
// import reader-db.js

// TODO: add assertions and logging
// TODO: use statuses instead of exceptions


let slideshow_current_slide = null;

const slideshow_settings_channel = new BroadcastChannel('settings');
slideshow_settings_channel.onmessage = function(event) {
  if(event.data === 'changed') {
    console.debug('settings change detected');
    entry_css_on_change(event);
  }
};

const slideshow_db_channel = new BroadcastChannel('db');
slideshow_db_channel.onmessage = function(event) {
  if(event.data && event.data.type === 'entryArchived') {
    console.log('Received archive entry request message');
  }
  else if(event.data && event.data.type === 'entryDeleted') {
    console.log('Received entry delete request message');
  }
};

const slideshow_poll_channel = new BroadcastChannel('poll');
slideshow_poll_channel.onmessage = function(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = slideshow_count_unread_slides();
    let conn; // leave undefined
    if(count < 2) {
      slideshow_append_slides(conn);
    }
  }
};

function slideshow_slide_remove(slide_element) {
  slide_element.removeEventListener('click', slideshow_slide_on_click);
  slide_element.remove();
}

// TODO: visual feedback in event of an error?
async function slideshow_slide_mark_read(conn, slide_element) {
  console.assert(indexeddb_is_open(conn));

  // This is normal and not an error
  if(slide_element.hasAttribute('read')) {
    return;
  }

  const entry_id_string = slide_element.getAttribute('entry');
  const radix = 10;
  const entry_id_number = parseInt(entry_id_string, radix);
  try {

    const status = await entry_mark_read(conn, entry_id_number);
    if(status !== STATUS_OK) {
      // TODO: react to error
      console.warn('slideshow_slide_mark_read failed to update database');
    }

    slide_element.setAttribute('read', '');
  } catch(error) {
    // TODO: handle error visually
    console.warn(error);
  }
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function slideshow_append_slides(conn) {
  const limit = 3;
  let is_local_conn = false;
  let entries = [];

  const offset = slideshow_count_unread_slides();

  try {
    if(!conn) {
      conn = await reader_db_open();
      is_local_conn = true;
    }

    entries = await reader_db_get_unarchived_unread_entries(conn, offset,
      limit);
  } catch(error) {
    console.warn(error);
  } finally {
    if(is_local_conn && conn)
      conn.close();
  }

  for(const entry of entries)
    slideshow_append_slide(entry);
  return entries.length;
}

// Add a new slide to the view.
function slideshow_append_slide(entry) {
  const container_element = document.getElementById('slideshow-container');
  const slide_element = document.createElement('div');

  // tabindex must be explicitly defined for div.focus()
  slide_element.setAttribute('tabindex', '-1');
  slide_element.setAttribute('entry', entry.id);
  slide_element.setAttribute('feed', entry.feed);
  slide_element.setAttribute('class','entry');
  slide_element.addEventListener('click', slideshow_slide_on_click);
  // Bind to slide, not window, because only slide scrolls
  // TODO: look into the new 'passive' flag for scroll listeners
  slide_element.addEventListener('scroll', slideshow_slide_on_scroll);
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

  const title_element = slideshow_create_article_title_element(entry);
  slide_element.appendChild(title_element);
  const content_element = slideshow_create_article_content_element(entry);
  slide_element.appendChild(content_element);
  const source_element = slideshow_create_feed_source_element(entry);
  slide_element.appendChild(source_element);

  container_element.appendChild(slide_element);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure slideshow_current_slide is always set. Where do I do this?
  if(container_element.childElementCount === 1) {
    slideshow_current_slide = slide_element;
    slideshow_current_slide.focus();
  }
}

function slideshow_create_article_title_element(entry) {
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

function slideshow_create_article_content_element(entry) {
  const content_element = document.createElement('span');
  content_element.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  content_element.innerHTML = entry.content;
  return content_element;
}

function slideshow_create_feed_source_element(entry) {
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

async function slideshow_slide_on_click(event) {
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if(event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  const anchor = event.target.closest('a');
  if(!anchor) {
    return true;
  }

  if(!anchor.hasAttribute('href')) {
    return true;
  }

  event.preventDefault();

  const url_string = anchor.getAttribute('href');
  chrome.tabs.create({'active': true, 'url': url_string});

  let conn;
  try {
    conn = await reader_db_open();
    await slideshow_slide_mark_read(conn, slideshow_current_slide);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  return false;
}

// TODO: visual feedback on error
async function slideshow_show_next_slide() {

  // slideshow_current_slide may be undefined
  // This isn't actually an error. For example, when initially viewing the
  // slideshow before subscribing when there are no feeds and entries, or
  // initially viewing the slideshow when all entries are read.
  if(!slideshow_current_slide) {
    console.warn('No current slide');
    return;
  }

  const old_slide_element = slideshow_current_slide;
  const unread_slide_element_count = slideshow_count_unread_slides();
  let num_slides_appended = 0;
  let conn;

  try {
    conn = await reader_db_open();

    // Conditionally append more slides
    if(unread_slide_element_count < 2)
      num_slides_appended = await slideshow_append_slides(conn);

    if(slideshow_current_slide.nextSibling) {
      slideshow_current_slide.style.left = '-100%';
      slideshow_current_slide.style.right = '100%';
      slideshow_current_slide.nextSibling.style.left = '0px';
      slideshow_current_slide.nextSibling.style.right = '0px';
      slideshow_current_slide.scrollTop = 0;
      slideshow_current_slide = slideshow_current_slide.nextSibling;

      // Change the active element to the new current slide, so that scrolling
      // with keys works
      slideshow_current_slide.focus();

      // Must be awaited
      await slideshow_slide_mark_read(conn, old_slide_element);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(num_slides_appended > 0) {
    slideshow_cleanup_slideshow_on_append();
  }
}

function slideshow_cleanup_slideshow_on_append() {
  // Weakly assert as this is trivial
  console.assert(slideshow_current_slide, 'slideshow_current_slide is undefined');

  const max_slide_count = 6;
  const container_element = document.getElementById('slideshow-container');
  while(container_element.childElementCount > max_slide_count &&
    container_element.firstChild !== slideshow_current_slide)
    slideshow_slide_remove(container_element.firstChild);
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function slideshow_show_prev_slide() {
  if(!slideshow_current_slide)
    return;
  const prev_slide_element = slideshow_current_slide.previousSibling;
  if(!prev_slide_element)
    return;
  slideshow_current_slide.style.left = '100%';
  slideshow_current_slide.style.right = '-100%';
  prev_slide_element.style.left = '0px';
  prev_slide_element.style.right = '0px';
  slideshow_current_slide = prev_slide_element;
  // Change the active element to the new current slide, so that scrolling
  // using keyboard keys still works
  slideshow_current_slide.focus();
}

function slideshow_count_unread_slides() {
  const unread_slides =
    document.body.querySelectorAll('div[entry]:not([read])');
  return unread_slides.length;
}

let keydown_timer = null;
window.addEventListener('keydown', function slideshow_on_key_down(event) {
  // Redefine space from page down to navigate next
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  if(code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    cancelIdleCallback(keydown_timer);
    keydown_timer = requestIdleCallback(slideshow_show_next_slide);
  } else if(code === LEFT || code === P) {
    event.preventDefault();
    cancelIdleCallback(keydown_timer);
    keydown_timer = requestIdleCallback(slideshow_show_prev_slide);
  }
});

// Override built in keyboard scrolling
let slideshow_scroll_callback_handle;
function slideshow_slide_on_scroll(event) {
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
  cancelIdleCallback(slideshow_scroll_callback_handle);
  slideshow_scroll_callback_handle = requestIdleCallback(on_idle_callback);
}

async function slideshow_on_dom_content_loaded(event) {
  console.debug('slideshow_on_dom_content_loaded');
  entry_css_init();
  let conn;
  try {
    await slideshow_append_slides(conn);
  } catch(error) {
    console.warn(error);
  }
}

document.addEventListener('DOMContentLoaded', slideshow_on_dom_content_loaded,
  {'once': true});
