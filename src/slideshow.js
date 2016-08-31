// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Global to file, track the current slide element
let current_slide = null;

chrome.runtime.onMessage.addListener(function(message) {
  switch(message.type) {
    case 'poll_completed':
      maybe_append_slides();
      break;
    case 'delete_entry_requested':
      break;
    case 'archive_entry_pending':
      break;
    default:
      break;
  }
});

function remove_slide(slide) {
  slide.removeEventListener('click', slide_onclick);
  slide.remove();
}

function mark_slide_read(slide) {
  if(!slide.hasAttribute('read')) {
    slide.setAttribute('read', '');
    mark_as_read(parseInt(slide.getAttribute('entry'), 10));
  }
}

function maybe_append_slides() {
  const count = count_unread_slides();
  if(count < 1) {
    const is_first = !document.getElementById('slideshow-container').firstChild;
    append_slides(hide_unread_slides, is_first);
  }
}

function append_slides(oncomplete, is_first) {
  let counter = 0;
  const limit = 5;
  const offset = count_unread_slides();
  let not_advanced = true;
  open_db(on_open_db);

  function on_open_db(connection) {
    if(connection) {
      const transaction = connection.transaction('entry');
      const entryStore = transaction.objectStore('entry');
      const index = entryStore.index('archiveState-readState');
      const key_path = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.UNREAD];
      const request = index.openCursor(key_path);
      request.onsuccess = on_open_cursor;
      request.onerror = on_open_cursor;
    } else {
      // TODO: show an error?
    }
  }

  function on_open_cursor(event) {
    const cursor = event.target.result;

    if(!cursor) {
      if(oncomplete) {
        oncomplete();
      }
      return;
    }

    if(not_advanced && offset) {
      not_advanced = false;
      cursor.advance(offset);
      return;
    }

    append_slide(cursor.value, is_first);

    if(is_first && counter === 0) {
      // TODO: could just directly query for the slide using querySelector,
      // which would match first slide in doc order.
      current_slide = document.getElementById('slideshow-container').firstChild;
      is_first = false;
    }

    if(++counter < limit) {
      cursor.continue();
    }
  }
}

const LEFT_MOUSE_BUTTON_CODE = 1;
const MOUSE_WHEEL_BUTTON_CODE = 2;

function slide_onclick(event) {
  const button_code = event.which;

  // Only react to left clicks
  if(button_code !== LEFT_MOUSE_BUTTON_CODE) {
    return false;
  }

  if(event.target.matches('img')) {
    if(!event.target.parentNode.matches('a')) {
      return false;
    }
  } else if(!event.target.matches('a')) {
    return false;
  }

  if(!event.currentTarget.hasAttribute('read')) {
    // We cannot remove the listener here because there may be additional
    // clicks on other links that we still want to capture. So we have to
    // defer until slide removal. So we just need to ensure that
    // currentTarget has not already been read.
    // NOTE: this means that super-fast extra clicks can retrigger
    // this call.
    //event.currentTarget.removeEventListener('click',
    //  slide_onclick);
    mark_slide_read(event.currentTarget);
  }

  // Prevent the normal link click behavior
  event.preventDefault();

  chrome.tabs.create({
    'active': true,
    'url': event.target.getAttribute('href')
  });

  return false;
}

// Add a new slide to the view. If is_first is true, the slide is immediately
// visible. Otherwise, the slide is positioned off screen.
function append_slide(entry, is_first) {
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', slide_onclick);

  slide.style.position = 'absolute';
  slide.style.left = is_first ? '0%' : '100%';
  slide.style.right = is_first ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const entry_link_url_string = Entry.prototype.get_url.call(entry);
  const title = document.createElement('a');
  title.setAttribute('href', entry_link_url_string);
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('rel', 'noreferrer');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    let title_text = entry.title;
    title_text = filter_article_title(title_text);
    // Max displayable length. This is different than max storable length,
    // it could be shorter or longer.
    title_text = truncate_html(title_text, 300);
    title.innerHTML = title_text;
  } else {
    title.textContent = 'Untitled';
  }
  slide.appendChild(title);

  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const parser = new DOMParser();
  const entry_doc = parser.parseFromString(entry.content, 'text/html');
  filter_boilerplate(entry_doc);
  sanitize_document(entry_doc);
  add_no_referrer_to_anchors(entry_doc);
  const entry_body = entry_doc.body || entry_doc.documentElement;
  move_child_nodes(entry_body, content);
  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  if(entry.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', entry.faviconURLString);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    source.appendChild(favicon_element);
  }

  const feed_title_element = document.createElement('span');
  if(entry.feedLink) {
    feed_title_element.setAttribute('title', entry.feedLink);
  }

  const feed_title_buffer = [];
  feed_title_buffer.push(entry.feedTitle || 'Unknown feed');
  feed_title_buffer.push(' by ');
  feed_title_buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    feed_title_buffer.push(' on ');
    feed_title_buffer.push(format_date(entry.datePublished));
  }

  feed_title_element.textContent = feed_title_buffer.join('');
  source.appendChild(feed_title_element);

  const container = document.getElementById('slideshow-container');
  container.appendChild(slide);
}

function show_next_slide() {
  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.
  const unread_count = count_unread_slides();
  if(unread_count < 2) {
    const is_first = false;
    append_slides(append_oncomplete, is_first);
  } else {
    show_next();
  }

  function append_oncomplete() {
    // Before navigating, cleanup some of the old slides so that we do not
    // display too many slides at once.
    // Note this is very sensitive to timing, it has to occur relatively
    // quickly.
    const c = document.getElementById('slideshow-container');
    while(c.childElementCount > 10 && c.firstChild != current_slide) {
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
function show_prev_slide() {
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

const KEY_CODES = {
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

const SCROLL_DELTAS = {};
SCROLL_DELTAS['' + KEY_CODES.DOWN] = [80, 400];
SCROLL_DELTAS['' + KEY_CODES.PAGE_DOWN] = [100, 800];
SCROLL_DELTAS['' + KEY_CODES.UP] = [-50, -200];
SCROLL_DELTAS['' + KEY_CODES.PAGE_UP] = [-100, -800];

let key_down_timer_id = null;

function on_key_down(event) {
  switch(event.keyCode) {
    case KEY_CODES.DOWN:
    case KEY_CODES.PAGE_DOWN:
    case KEY_CODES.UP:
    case KEY_CODES.PAGE_UP:
      event.preventDefault();
      if(current_slide) {
        const delta = SCROLL_DELTAS['' + event.keyCode];
        smooth_scroll_to(current_slide, delta[0],
          current_slide.scrollTop + delta[1]);
      }
      break;
    case KEY_CODES.SPACE:
      event.preventDefault();
    case KEY_CODES.RIGHT:
    case KEY_CODES.N:
      clearTimeout(key_down_timer_id);
      key_down_timer_id = setTimeout(show_next_slide, 50);
      break;
    case KEY_CODES.LEFT:
    case KEY_CODES.P:
      clearTimeout(key_down_timer_id);
      key_down_timer_id = setTimeout(show_prev_slide, 50);
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', on_key_down, false);

function init(event) {
  document.removeEventListener('DOMContentLoaded', init);
  DisplaySettings.load_styles();
  append_slides(maybe_show_all_read_slide, true);
}

document.addEventListener('DOMContentLoaded', init);

} // End file block scope
