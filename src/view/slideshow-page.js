// See license.md
'use strict';

{ // Begin file block scope

let current_slide_element = null;

const settings_channel = new BroadcastChannel('settings');
settings_channel.onmessage = function settings_channel_onmessage(event) {
  if(event.data === 'changed')
    update_entry_css_rules(event);
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
    const count = count_unread_slide_elements();
    let conn; // leave undefined
    const verbose = true;// Temporarily true for debugging purposes
    if(count < 2)
      append_slides(conn, verbose);
  }
};

function remove_slide(slide_element) {
  slide_element.removeEventListener('click', slide_on_click);
  slide_element.remove();
}

// TODO: visual feedback in event of an error?
async function mark_slide_read(conn, slide_element, verbose) {
  // This is not an error. This happens routinely as a result of navigating
  // to prior articles then navigating forward. It is not the responsibility
  // of the caller to only call on unread slides
  if(slide_element.hasAttribute('read'))
    return;

  const entry_id_string = slide_element.getAttribute('entry');
  const radix = 10;
  const entry_id_number = parseInt(entry_id_string, radix);
  let is_local_conn = false;
  let name, version, conn_timeout_ms;
  try {
    if(!conn) {
      conn = await reader_open_db(name, version, conn_timeout_ms, verbose);
      is_local_conn = true;
    }

    await mark_entry_read(conn, entry_id_number, verbose);
    slide_element.setAttribute('read', '');
  } catch(error) {
    // TODO: show an error message or something
    console.warn(error);
  } finally {
    if(is_local_conn && conn)
      conn.close();
  }
}

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance. The parameter to getAll
// might be (offset+limit)
function db_load_unarchived_unread_entries(conn, offset, limit, verbose) {
  function resolver(resolve, reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const is_limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      if(verbose)
        console.log('Loaded %d entries from database', entries.length);
      resolve(entries);
    };
    tx.onerror = function(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(key_path);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(is_limited && ++counter < limit)
            cursor.continue();
        }
      }
    };
  }
  return new Promise(resolver);
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function append_slides(conn, verbose) {
  const limit = 3;
  let is_local_conn = false;
  let entries = [];
  let name, version, conn_timeout_ms;

  const offset = count_unread_slide_elements();

  try {
    if(!conn) {
      conn = await reader_open_db(name, version, conn_timeout_ms, verbose);
      is_local_conn = true;
    }

    entries = await db_load_unarchived_unread_entries(conn, offset, limit,
      verbose);
  } catch(error) {
    console.error(error);
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
  // Bind to slide, not window, because only slide scrolls, not window
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
  title_element.setAttribute('href', entry_get_url_string(entry));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('target','_blank');
  title_element.setAttribute('rel', 'noreferrer');
  title_element.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    title_element.setAttribute('title', entry.title);
    let titleText = entry.title;
    titleText = filter_article_title(titleText);
    titleText = truncate_html(titleText, 300);
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
    buffer.push(format_date(entry.datePublished));
  }
  title_element.textContent = buffer.join('');
  source_element.appendChild(title_element);

  return source_element;
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
  // TODO: maybe this should be a call to a helper about getting words array
  const tail_string = title.substring(index + 1);
  const tail_words = tail_string.split(/\s+/g);
  const non_empty_tail_words = tail_words.filter((w) => w);
  let output_title;
  if(non_empty_tail_words.length < 5) {
    output_title = title.substring(0, index);
    output_title = output_title.trim();
  } else {
    output_title = title;
  }
  return output_title;
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
  const verbose = true;// temp
  mark_slide_read(conn, current_slide_element, verbose).catch(console.warn);

  return false;
}

// TODO: visual feedback on error
async function show_next_slide() {
  const verbose = true;// Temporarily true for debugging purposes

  // current_slide_element may be undefined
  // This isn't actually an error. For example, when initially viewing the
  // slideshow before subscribing when there are no feeds and entries, or
  // initially viewing the slideshow when all entries are read.
  if(!current_slide_element) {
    console.warn('No current slide');
    return;
  }

  const old_slide_element = current_slide_element;
  const unread_slide_element_count = count_unread_slide_elements();
  let num_slides_appended = 0;
  let conn, name, version, conn_timeout_ms;

  try {
    conn = await reader_open_db(name, version, conn_timeout_ms, verbose);

    // Conditionally append more slides
    if(unread_slide_element_count < 2)
      num_slides_appended = await append_slides(conn, verbose);

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
      await mark_slide_read(conn, old_slide_element, verbose);
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
    remove_slide(container_element.firstChild);
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

function count_unread_slide_elements() {
  const unread_slides =
    document.body.querySelectorAll('div[entry]:not([read])');
  return unread_slides.length;
}

function format_date(date_object, delimiter) {
  const parts = [];
  if(date_object) {
    // getMonth is a zero based index
    parts.push(date_object.getMonth() + 1);
    parts.push(date_object.getDate());
    parts.push(date_object.getFullYear());
  }
  return parts.join(delimiter || '/');
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
// TODO: look into the new 'passive' flag for scroll listeners
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
  add_entry_css_rules();
  let conn;// leave as undefined
  const verbose = true; // Temporarily true for debugging
  append_slides(conn, verbose).catch(console.warn);
}

document.addEventListener('DOMContentLoaded', on_dom_content_loaded,
  {'once': true});

} // End file block scope
