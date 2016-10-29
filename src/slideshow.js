// See license.md

'use strict';

{ // Begin file block scope

// Reference to element
let current_slide = null;

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

function mark_slide_read(slide) {
  if(slide.hasAttribute('read'))
    return;
  slide.setAttribute('read', '');
  const id = parseInt(slide.getAttribute('entry'), 10);
  db_mark_entry_read(id);
}

// Resolves to number appended
function append_slides() {
  return new Promise(append_slides_impl);
}

// TODO: even though this is the only place this is called, it really does
// not belong here. The UI should not be communicating directly with the
// database. I need to design a paging API for iterating over these entries
// and the UI should be calling that paging api.
// TODO: require caller to establish conn, do not do it here
// TODO: visual feedback on error
async function append_slides_impl(resolve, reject) {
  let conn = null;
  try {
    conn = await db_connect();
    const limit = 3;
    const offset = count_unread_slides();
    const entries = await db_get_unarchived_unread_entries(conn, offset, limit);
    for(let entry of entries)
      append_slide(entry);
    resolve(entries.length);
  } catch(error) {
    console.debug(error);
    reject(error);
  } finally {
    if(conn)
      conn.close();
  }
}

// Add a new slide to the view.
function append_slide(entry) {
  const container = document.getElementById('slideshow-container');

  const slide = document.createElement('div');
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
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title = create_article_title(entry);
  slide.appendChild(title);
  const content = create_article_content(entry);
  slide.appendChild(content);
  const source = create_feed_source(entry);
  slide.appendChild(source);

  container.appendChild(slide);

  if(container.childElementCount === 1)
    current_slide = slide;
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
  // TODO: will this suppress right click too? I don't want that
  event.preventDefault();

  const left_mouse_btn_code = 1;
  // TODO: i may need to use event.currentTarget, i think target is just where
  // listener is bound?
  if(event.which === left_mouse_btn_code && event.currentTarget.matches('a')) {
    console.debug('left clicked on link in current slide', event.target);

    mark_slide_read(current_slide);
    chrome.tabs.create({
      'active': true,
      'url': event.target.getAttribute('href')
    });
  } else {
    console.debug('Click event unhandled', event);
  }

  return false;
}

// TODO: the cleanup should take place _after_ navigation so as to limit jank
// TODO: marking the current slide as read should take place after navigation
// so as to limit perceivable lag
// TODO: this is connecting twice now, mark_slide_read should share conn
async function show_next_slide() {

  const current_slide_before_shift = current_slide;

  // Conditionally append more slides
  const unread_count = count_unread_slides();
  if(unread_count < 2) {
    try {
      await append_slides();
    } catch(error) {
      console.debug(error);
    }
  }

  // Move the current slide out of view and mark it as read, and move the
  // next slide into view
  if(current_slide.nextSibling) {
    // Move the current slide out of view
    current_slide.style.left = '-100%';
    current_slide.style.right = '100%';
    // Move the next slide into view
    current_slide.nextSibling.style.left = '0px';
    current_slide.nextSibling.style.right = '0px';
    // Reset the current slide's scroll position
    current_slide.scrollTop = 0;
    current_slide = current_slide.nextSibling;
  }

  mark_slide_read(current_slide_before_shift);

  // Shrink the number of loaded slides
  const c = document.getElementById('slideshow-container');
  while(c.childElementCount > 6 && c.firstChild != current_slide) {
    remove_slide(c.firstChild);
  }
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function show_prev_slide() {
  if(current_slide.previousSibling) {
    current_slide.style.left = '100%';
    current_slide.style.right = '-100%';
    current_slide.previousSibling.style.left = '0px';
    current_slide.previousSibling.style.right = '0px';
    current_slide = current_slide.previousSibling;
  }
}

function count_unread_slides() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
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

let keydown_timer = null;

function on_key_down(event) {
  switch(event.keyCode) {
    case key_codes.DOWN:
    case key_codes.PAGE_DOWN:
    case key_codes.UP:
    case key_codes.PAGE_UP:
      event.preventDefault();
      if(current_slide) {
        const deltas = {};
        deltas['' + key_codes.DOWN] = [80, 400];
        deltas['' + key_codes.PAGE_DOWN] = [100, 800];
        deltas['' + key_codes.UP] = [-50, -200];
        deltas['' + key_codes.PAGE_UP] = [-100, -800];
        const delta = deltas['' + event.keyCode];
        smooth_scroll(current_slide, delta[0],
          current_slide.scrollTop + delta[1]);
      }
      break;
    case key_codes.SPACE:
      event.preventDefault();
    case key_codes.RIGHT:
    case key_codes.N:
      clearTimeout(keydown_timer);
      // TODO: what about setImmediate instead? Or animationFrame?
      keydown_timer = setTimeout(show_next_slide, 0);
      break;
    case key_codes.LEFT:
    case key_codes.P:
      clearTimeout(keydown_timer);
      keydown_timer = setTimeout(show_prev_slide, 0);
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', on_key_down, false);

function init_slides(event) {
  document.removeEventListener('DOMContentLoaded', init_slides);
  DisplaySettings.load_styles();
  append_slides();
}

// TODO: look into the {once:true} thing
document.addEventListener('DOMContentLoaded', init_slides);

} // End file block scope
