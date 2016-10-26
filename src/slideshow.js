// See license.md

'use strict';

{ // Begin file block scope

// Reference to element
let current_slide = null;

// Leave the db channel open for as long as the page is open
const dbChannel = new BroadcastChannel('db');
dbChannel.onmessage = function(event) {
  if(event.data.type === 'archive_entry_request') {
    console.log('Received archive entry request message, not yet implemented');
  } else if(event.data.type === 'delete_entry_request') {
    console.log('Received entry delete request message, not yet implemented');
  }
};

const pollChannel = new BroadcastChannel('poll');
pollChannel.onmessage = function(event) {
  if(event.data === 'completed') {
    const count = count_unread_slides();
    if(count < 1) {
      const is_first_slide = !document.getElementById(
        'slideshow-container').firstChild;
      append_slides(hide_unread_slides, is_first_slide);
    }
  }
};

function remove_slide(slide) {
  slide.removeEventListener('click', slide_on_click);
  slide.remove();
}

async function mark_slide_read(slide) {
  if(slide.hasAttribute('read'))
    return;
  slide.setAttribute('read', '');
  const id = parseInt(slide.getAttribute('entry'), 10);
  try {
    db_mark_entry_read(id);
  } catch(error) {
    console.debug(error);
  }
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

// TODO: even though this is the only place this is called, it really does
// not belong here. The UI should not be communicating directly with the
// database. I need to design a paging API for iterating over these entries
// and the UI should be calling that paging api.
// TODO: full convert to async
// TODO: this also needs to return a promise so that callers can use
// async await syntax
async function append_slides(append_on_complete, is_first_slide) {
  let counter = 0;
  const limit = 3;
  const offset = count_unread_slides();

  // TODO: invert this, and the condition where it is used, to is_advanced
  let is_not_advanced = true;

  let conn = null;
  try {
    conn = await db_connect(undefined, console);
  } catch(error) {
    console.debug(error);
    return;
  }

  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [ENTRY_UNARCHIVED, ENTRY_UNREAD];
  const request = index.openCursor(keyPath);
  request.onsuccess = open_cursor_on_success;
  request.onerror = function(event) {
    // TODO: show an error?
    if(append_on_complete)
      append_on_complete();
  };
  conn.close();

  function open_cursor_on_success(event) {
    const cursor = event.target.result;
    if(!cursor) {
      if(append_on_complete)
        append_on_complete();
      return;
    }

    if(is_not_advanced && offset) {
      is_not_advanced = false;
      cursor.advance(offset);
      return;
    }

    const entry = cursor.value;
    append_slide(entry, is_first_slide);

    if(is_first_slide && counter === 0) {
      // TODO: could just directly query for the slide using querySelector,
      // which would match first slide in doc order.
      current_slide = document.getElementById(
        'slideshow-container').firstChild;
      is_first_slide = false;
    }

    if(++counter < limit)
      cursor.continue();
  }
}


// Add a new slide to the view. If is_first_slide is true, the slide is
// immediately visible. Otherwise, the slide is positioned off screen.
function append_slide(entry, is_first_slide) {
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', slide_on_click);
  slide.style.position = 'absolute';
  slide.style.left = is_first_slide ? '0%' : '100%';
  slide.style.right = is_first_slide ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title = create_article_title(entry);
  slide.appendChild(title);
  const content = create_article_content(entry);
  slide.appendChild(content);
  const source = create_feed_source(entry);
  slide.appendChild(source);
  const container = document.getElementById('slideshow-container');
  container.appendChild(slide);
}

function create_article_title(entry) {
  const title = document.createElement('a');
  title.setAttribute('href', get_entry_url(entry));
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
  // This is the slowest line. Is there anyway to speed this up?
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


const left_mouse_btn_code = 1;
const mouse_wheel_btn_code = 2;

function slide_on_click(event) {
  const button_code = event.which;

  // Only react to left clicks
  if(button_code !== left_mouse_btn_code)
    return false;

  if(event.target.matches('img')) {
    if(!event.target.parentNode.matches('a'))
      return false;
  } else if(!event.target.matches('a'))
    return false;

    // We cannot remove the listener here because there may be additional
    // clicks on other links that we still want to capture. So we have to
    // defer until slide removal. So we just need to ensure that
    // currentTarget has not already been read.
  if(!event.currentTarget.hasAttribute('read')) {
    mark_slide_read(event.currentTarget);
  }

  event.preventDefault();
  chrome.tabs.create({
    'active': true,
    'url': event.target.getAttribute('href')
  });
  return false;
}

function goto_next_slide() {
  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.
  const unread_count = count_unread_slides();
  if(unread_count < 2) {
    const is_first_slide = false;
    append_slides(append_on_complete, is_first_slide);
  } else {
    show_next();
  }

  function append_on_complete() {
    // Before navigating, cleanup some of the old slides so that we do not
    // display too many slides at once.
    // Note this is very sensitive to timing, it has to occur relatively
    // quickly.
    const c = document.getElementById('slideshow-container');
    while(c.childElementCount > 6 && c.firstChild != current_slide) {
      remove_slide(c.firstChild);
    }

    show_next();
    maybe_show_all_read_slide();
  }

  // Move the current slide out of view and mark it as read, and move the
  // next slide into view, and then update the global variable that tracks
  // the current slide.
  function show_next() {
    const current = current_slide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      mark_slide_read(current);
      current_slide = current.nextSibling;
    }
  }
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function goto_previous_slide() {
  const current = current_slide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    current_slide = current.previousSibling;
  }
}

function count_unread_slides() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
}

function maybe_show_all_read_slide() {
  // Not yet implemented
}

function hide_unread_slides() {
  // Not yet implemented
}

const key_codes = {
  'SPACE': 32,
  'PAGE_UP': 33,
  'PAGE_DOWN': 34,
  'LEFT': 37,
  'UP': 38,
  'RIGHT': 39,
  'DOWN': 40,
  'N': 78,
  'P': 80
};

const scroll_deltas = {};
scroll_deltas['' + key_codes.DOWN] = [80, 400];
scroll_deltas['' + key_codes.PAGE_DOWN] = [100, 800];
scroll_deltas['' + key_codes.UP] = [-50, -200];
scroll_deltas['' + key_codes.PAGE_UP] = [-100, -800];

let keydown_timer = null;

function on_key_down(event) {
  switch(event.keyCode) {
    case key_codes.DOWN:
    case key_codes.PAGE_DOWN:
    case key_codes.UP:
    case key_codes.PAGE_UP:
      event.preventDefault();
      if(current_slide) {
        const delta = scroll_deltas['' + event.keyCode];
        smooth_scroll(current_slide, delta[0],
          current_slide.scrollTop + delta[1]);
      }
      break;
    case key_codes.SPACE:
      event.preventDefault();
    case key_codes.RIGHT:
    case key_codes.N:
      clearTimeout(keydown_timer);
      keydown_timer = setTimeout(goto_next_slide, 50);
      break;
    case key_codes.LEFT:
    case key_codes.P:
      clearTimeout(keydown_timer);
      keydown_timer = setTimeout(goto_previous_slide, 50);
      break;
    default:
      break;
  }
}

// I am expressly using window here to make it clear where the listener is
// attached
window.addEventListener('keydown', on_key_down, false);

function init_slides(event) {
  document.removeEventListener('DOMContentLoaded', init_slides);
  DisplaySettings.load_styles();
  append_slides(maybe_show_all_read_slide, true);
}

document.addEventListener('DOMContentLoaded', init_slides);

} // End file block scope
