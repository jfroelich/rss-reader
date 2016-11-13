// See license.md

'use strict';

{ // Begin file block scope

// Reference to element
let current_slide = null;

const db_chan = new BroadcastChannel('db');
db_chan.onmessage = function(event) {
  if(event.data.type === 'archive_entry') {
    console.log('Received archive entry request message, not yet implemented');
  } else if(event.data.type === 'entryDeleted') {
    console.log('Received entry delete request message, not yet implemented');
  }
};

const poll_chan = new BroadcastChannel('poll');
poll_chan.onmessage = function(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = count_unread_slides();
    if(count < 2)
      append_slides();
  }
};

function remove_slide(slide) {
  slide.removeEventListener('click', slide_on_click);
  slide.remove();
}

// TODO: visual feedback in event of an error?
async function mark_slide_read(slide) {
  if(slide.hasAttribute('read'))
    return;
  slide.setAttribute('read', '');
  const entry_id = parseInt(slide.getAttribute('entry'), 10);

  const feedDb = new FeedDb();
  try {
    await feedDb.connect();
    await db_mark_entry_read(feedDb, entry_id);
  } finally {
    feedDb.close();
  }
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function append_slides() {
  const limit = 3;
  const offset = count_unread_slides();

  const db = new FeedDb();
  let entries = [];
  try {
    await db.connect();
    entries = await db.getUnarchivedUnreadEntries(offset, limit);
  } finally {
    db.close();
  }

  for(let entry of entries)
    append_slide(entry);
  return entries.length;
}

// Add a new slide to the view.
function append_slide(entry) {
  const container = document.getElementById('slideshow-container');
  const slide = document.createElement('div');

  // tabindex must be explicitly defined on a div in order for div.focus() to
  // affect the active element
  slide.setAttribute('tabindex', '-1');

  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', slide_on_click);
  slide.style.position = 'absolute';

  if(container.childElementCount === 0) {
    slide.style.left = '0%';
    slide.style.right = '0%';
  } else {
    slide.style.left = '100%';
    slide.style.right = '-100%';
  }

  slide.style.overflowX = 'hidden';
  slide.style.top = '0';
  slide.style.bottom = '0';
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title = create_article_title(entry);
  slide.appendChild(title);
  const content = create_article_content(entry);
  slide.appendChild(content);
  const source = create_feed_source(entry);
  slide.appendChild(source);

  container.appendChild(slide);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure current_slide is always set. Where do I do this?
  if(container.childElementCount === 1) {
    current_slide = slide;
    current_slide.focus();
  }
}

function create_article_title(entry) {
  const title = document.createElement('a');
  title.setAttribute('href', Entry.getURL(entry));
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('rel', 'noreferrer');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    title.setAttribute('title', entry.title);
    let title_text = entry.title;
    title_text = filter_article_title(title_text);
    title_text = truncate_html(title_text, 300);
    title.innerHTML = title_text;
  } else {
    title.setAttribute('title', 'Untitled');
    title.textContent = 'Untitled';
  }

  return title;
}

function create_article_content(entry) {
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  content.innerHTML = entry.content;
  return content;
}

function create_feed_source(entry) {
  const source = document.createElement('span');
  source.setAttribute('class','entrysource');

  if(entry.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', entry.faviconURLString);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    source.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  if(entry.feedLink) {
    title_element.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(format_date(entry.datePublished));
  }
  title_element.textContent = buffer.join('');
  source.appendChild(title_element);
  return source;
}

function filter_article_title(title) {
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;
  // todo: should this be +3 given the spaces wrapping the delim?
  const tail = title.substring(index + 1);
  const num_terms = tail.split(/\s+/g).filter((w) => w).length;
  return num_terms < 5 ? title.substring(0, index).trim() : title;
}

function slide_on_click(event) {
  const left_mouse_btn_code = 1;
  if(event.which !== left_mouse_btn_code)
    return true;
  const anchor = event.target.closest('a');
  if(!anchor)
    return true;
  if(!anchor.hasAttribute('href'))
    return true;
  chrome.tabs.create({'active': true, 'url': anchor.getAttribute('href')});
  mark_slide_read(current_slide);
  event.preventDefault();
  return false;
}

// TODO: this is connecting twice now, I want to be using only a single conn
// for both append slides and mark_slide_read
// TODO: there is some minor annoyance, that in the case of append, this
// does the animation super fast
// TODO: visual feedback on error
async function show_next_slide() {

  // If slide count is 0, current_slide may be undefined
  if(!current_slide) {
    console.warn('No current slide');
    return;
  }

  const old_slide = current_slide;

  // Conditionally append more slides
  const unread_count = count_unread_slides();
  let num_appended = 0;
  if(unread_count < 2)
    num_appended = await append_slides();

  if(current_slide.nextSibling) {
    current_slide.style.left = '-100%';
    current_slide.style.right = '100%';
    current_slide.nextSibling.style.left = '0px';
    current_slide.nextSibling.style.right = '0px';
    current_slide.scrollTop = 0;
    current_slide = current_slide.nextSibling;

    // Change the active element to the new current slide, so that scrolling
    // using keyboard keys still works
    current_slide.focus();

    await mark_slide_read(old_slide);
  }

  // Shrink the number of slides
  if(num_appended > 0) {
    const container = document.getElementById('slideshow-container');
    while(container.childElementCount > 6 &&
      container.firstChild !== current_slide) {
      remove_slide(container.firstChild);
    }
  }
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function show_prev_slide() {

  if(!current_slide) {
    console.warn('No current slide');
    return;
  }

  const prev = current_slide.previousSibling;
  if(!prev)
    return;
  current_slide.style.left = '100%';
  current_slide.style.right = '-100%';
  prev.style.left = '0px';
  prev.style.right = '0px';
  current_slide = prev;

  // Change the active element to the new current slide, so that scrolling
  // using keyboard keys still works
  current_slide.focus();
}

function count_unread_slides() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
}

let nav_keydown_timer = null;
window.addEventListener('keydown', function(event) {
  // Redefine space from page down to navigate next
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;
  if(code === RIGHT || code === N || code === SPACE) {
    cancelIdleCallback(nav_keydown_timer);
    nav_keydown_timer = requestIdleCallback(show_next_slide);
  } else if(code === LEFT || code === P) {
    cancelIdleCallback(nav_keydown_timer);
    nav_keydown_timer = requestIdleCallback(show_prev_slide);
  }
});

// Override built in keyboard scrolling
let scroll_callback_handle;
window.addEventListener('keydown', function(ev) {
  const DOWN = 40, UP = 38, ae = document.activeElement;
  if(ev.keyCode !== DOWN && ev.keyCode !== UP) return;
  if(!ae) return;
  ev.preventDefault();
  cancelIdleCallback(scroll_callback_handle);
  scroll_callback_handle = requestIdleCallback(() =>
    ae.scrollTop += ev.keyCode === UP ? -200 : 200);
});


function init_slides(event) {
  display_load_styles();
  append_slides();
}

// TODO: look into the {once:true} thing
document.addEventListener('DOMContentLoaded', init_slides, {'once': true});

} // End file block scope
