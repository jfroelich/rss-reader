// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: decouple loading of additional content with navigation. It causes
// lag. Instead, create a queue of articles, and refill it periodically on
// some type of schedule (using setInterval or a re-setTimeout-per-append)
// Only append during navigation if the queue has not yet refilled.

// TODO: if advancing to next article too quickly, some articles are loaded
// that were already loaded, leading to duplicate articles. The call to append
// articles needs to be delayed until scrolling completes or something like
// that. Actually I think it is because the mark-read is on a diff 'thread'
// than the update code. The append needs to wait for mark read to complete.

// TODO: rather than store slideshow_currentSlide in global state,
// use a simple object instance that we store in global state that wraps
// this variable. This will also avoid the need to pass around the variable
// because functions that need to access it can just be defined on the
// prototype and access via 'this'.

let slideshow_currentSlide = null;

function slideshow_onmessage(message) {
  switch(message.type) {
    case 'pollCompleted':
      slideshow_maybe_append_slides();
      break;
    case 'subscribe':
      slideshow_maybe_append_slides();
      break;

    // NOTE: I believe this was deprecated
    //case 'unsubscribe':
    //  slideshow_on_unsubscribe();
    //  break;
    case 'entryDeleteRequestedByUnsubscribe':
      console.debug('Reaction to removal of entry %s not yet implemented',
        message.entryId);
      break;
    case 'archivedEntry':
      // TODO: react to the archiving of an entry that is read
      // and possibly still loaded into the view
      break;
    default:
      // Ignore the message
      break;
  }
}

chrome.runtime.onMessage.addListener(slideshow_onmessage);

// Attempts to filter publisher information from an article's title.
// The input data generally looks like 'Article Title - Delimiter - Publisher'.
// The basic approach involves looking for an end delimiter, and if one is
// found, checking the approximate number of words following the delimiter,
// and if the number is less than a given threshold, returning a new string
// without the final delimiter or any of the words following it. This uses the
// threshold condition to reduce the chance of confusing the title with the
// the publisher in the case that there is an early delimiter, based on the
// assumption that the title is usually longer than the pubisher, or rather,
// that the publisher's name is generally short.
//
// There are probably some great enhancements that could be done, such as not
// truncating in the event the resulting title would be too short, as in, the
// the resulting title would not contain enough words. We could also consider
// comparing the number of words preceding the final delimiter to the number
// of words trailing the final delimiter. I could also consider trying to
// remove the publisher when it is present as a prefix, but this seems to be
// less frequent.
function slideshow_filter_article_title(title) {
  if(!title)
    return;
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;
  const trailingText = title.substring(index + 1);
  const terms = string_tokenize(trailingText);
  if(terms.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
}

function slideshow_maybe_append_slides() {
  const unreadCount = slideshow_count_unread();
  if(unreadCount) {
    // There are still some unread slides loaded, so do not bother appending
    return;
  }

  // TODO: we can use querySelector to get the first slide
  // itself instead of getting the parent container and
  // checking its children.
  // TODO: we do not actually need a count here, just a check
  // of whether firstElementChild is defined.

  const isFirst = !document.getElementById('slideshow-container').firstChild;
  slideshow_append_slides(slideshow_hide_all_unread, isFirst);
}

function slideshow_on_unsubscribe(message) {
  const slidesForFeed = document.querySelectorAll(
    'div[feed="'+ message.feed +'"]');
  const removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function removeAndCheck(removedCurrent, slide) {
    // TODO: verify removing all listeners
    slideshow_remove_slide(slide);
    return removedCurrent || (slide === slideshow_currentSlide);
  }, false);

  if(removedCurrentSlide) {
    // TODO: implement
    console.warn('Removed current slide as a result of unsubscribing but did'+
      ' not update UI');
  }

  slideshow_maybe_show_all_read();
}

function slideshow_remove_slide(slideElement) {
  slideElement.removeEventListener('click', slideshow_on_slide_click);
  slideElement.remove();
}

function slideshow_mark_read(slide) {
  if(slide.hasAttribute('read')) {
    return;
  }

  slide.setAttribute('read', '');
  const entryAttribute = slide.getAttribute('entry');

  db_open(on_open);

  function on_open(event) {
    if(event.type !== 'success') {
      // TODO: react to database error?
      console.debug(event);
      return;
    }

    const entryId = parseInt(entryAttribute);
    const connection = event.target.result;
    entry_mark_as_read(connection, entryId);
  }
}

function slideshow_append_slides(oncomplete, isFirst) {
  let counter = 0;
  const limit = 5;
  const offset = slideshow_count_unread();
  let notAdvanced = true;
  db_open(on_dbopen);

  // Load all articles that are unread and unarchived
  function on_dbopen(event) {
    if(event.type !== 'success') {
      // TODO: show an error?
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('entry');
    transaction.oncomplete = oncomplete;
    const entryStore = transaction.objectStore('entry');
    const index = entryStore.index('archiveState-readState');
    const range = IDBKeyRange.only([ENTRY_FLAGS.UNARCHIVED,
      ENTRY_FLAGS.UNREAD]);
    const request = index.openCursor(range);
    request.onsuccess = request_onsuccess;
  }

  function request_onsuccess() {
    const cursor = this.result;

    if(!cursor) {
      return;
    }

    if(notAdvanced && offset) {
      notAdvanced = false;
      cursor.advance(offset);
      return;
    }

    slideshow_append_slide(cursor.value, isFirst);

    if(isFirst && counter === 0) {
      // TODO: could just directly query for the slide
      // using querySelector, which would match first slide
      // in doc order.
      slideshow_currentSlide = document.getElementById(
        'slideshow-container').firstChild;
      isFirst = false;
    }

    if(++counter < limit) {
      cursor.continue();
    }
  }
}

// TODO: just checking if image parent is in anchor is incorrect
// The correct condition is if image is a descendant of an anchor, use
// closest instead of parentNode
// TODO: this should probably be the handler that determines
// whether to open an anchor click in a new tab, instead of
// setting a target attribute per anchor.
// NOTE: event.target is what was clicked. event.currentTarget is where the
// listener is attached.
function slideshow_on_slide_click(event) {
  const mouseButtonCode = event.which;
  const LEFT_MOUSE_BUTTON_CODE = 1;
  const MOUSE_WHEEL_BUTTON_CODE = 2;

  // Only react to left clicks
  if(mouseButtonCode !== LEFT_MOUSE_BUTTON_CODE) {
    return false;
  }

  // TODO: define event.target using a variable. What does it mean. Does it
  // mean the dom object to which the listener is attached? Or does it
  // mean the element that was clicked on? etc.

  // TODO: bug, when clicking on an image in a link, it is still a link
  // click that should open the link in a new window...
  // TODO: this should be checking if in anchor axis, not
  // just immediate parent
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
    //  slideshow_on_slide_click);
    slideshow_mark_read(event.currentTarget);
  }

  // Prevent the normal link click behavior
  event.preventDefault();

  chrome.tabs.create({
    active: true,
    url: event.target.getAttribute('href')
  });

  return false;
}

/**
 * Add a new slide to the view. If isFirst is true, the slide
 * is immediately visible. Otherwise, the slide is positioned
 * off screen.
 * NOTE: in the current design, fetched content scrubbing is
 * done onLoad instead of onBeforeStore. This is not
 * the best performance. This is done primarily to simplify
 * development. However, it also means we can defer decisions
 * about rendering, which provides a chance to customize the
 * rendering for already stored content and not just content
 * fetched in the future. It also emphasizes that scrubbing
 * must be tuned to be fast enough not to cause lag while
 * blocking, because this is synchronous.
 */
function slideshow_append_slide(entry, isFirst) {
  // TODO: use <article> instead of div
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', slideshow_on_slide_click);

  slide.style.position='absolute';
  slide.style.left = isFirst ? '0%' : '100%';
  slide.style.right = isFirst ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title = document.createElement('a');
  title.setAttribute('href', entry.link);
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    // TODO: also strip control characters?
    // TODO: did I do this sanitization earlier, like when storing? if so
    // then i don't need to be stripping tags or removing control chars
    // here.
    let titleText = html_replace(entry.title || '', '');
    titleText = slideshow_filter_article_title(titleText);
    titleText = string_truncate(titleText, 300);
    title.textContent = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  // TODO: use section instead of span
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const entryContentDocument = html_parse_string(entry.content);
  Calamine.removeBoilerplate(entryContentDocument);
  sanity_sanitize_document(entryContentDocument);
  const entryContentBody = entryContentDocument.body ||
    entryContentDocument.documentElement;
  dom_append_children(entryContentBody, content);

  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  const favIcon = document.createElement('img');
  const iconSource = favicon_get_url(entry.feedLink);
  favIcon.setAttribute('src', iconSource);
  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  const feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  const entryPubDate = entry.pubdate ?
    ' on ' + date_format(new Date(entry.pubdate)) : '';
  feedTitle.textContent = (entry.feedTitle || 'Unknown feed') + ' by ' +
    (entry.author || 'Unknown author') + entryPubDate;
  source.appendChild(feedTitle);

  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.appendChild(slide);
}

function slideshow_show_next_slide() {
  if(slideshow_count_unread() < 2) {
    const isFirst = false;
    slideshow_append_slides(on_append_complete, isFirst);
  } else {
    show_next();
  }

  function on_append_complete() {
    const c = document.getElementById('slideshow-container');
    while(c.childElementCount > 30 && c.firstChild != slideshow_currentSlide) {
      slideshow_remove_slide(c.firstChild);
    }

    show_next();
    slideshow_maybe_show_all_read();
  }

  function show_next() {
    const current = slideshow_currentSlide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      slideshow_mark_read(current);
      slideshow_currentSlide = current.nextSibling;
    }
  }
}

function slideshow_show_previous_slide() {
  const current = slideshow_currentSlide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    slideshow_currentSlide = current.previousSibling;
  }
}

function slideshow_is_unread_entry(entryElement) {
  return !entryElement.hasAttribute('read');
}

function slideshow_count_unread() {
  const slides = document.body.querySelectorAll('div[entry]:not([read])');
  return slides ? slides.length : 0;
}

function slideshow_maybe_show_all_read() {
  const numUnread = slideshow_count_unread();
  if(numUnread) {
    return;
  }

  console.warn('slideshow_maybe_show_all_read not implemented');
}

function slideshow_hide_all_unread() {
  console.warn('slideshow_hide_all_unread not implemented');
}

const SLIDESHOW_KEY_CODES = {
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

const SLIDESHOW_SCROLL_DELTAS = {
  '40': [50, 200],
  '34': [100, 800],
  '38': [-50, -200],
  '33': [-100, -800]
};

let slideshow_keydown_timer;

function slideshow_onkeydown(event) {
  //event.target is body
  //event.currentTarget is window

  // Override the default behavior for certain keys
  switch(event.keyCode) {
    case SLIDESHOW_KEY_CODES.SPACE:
    case SLIDESHOW_KEY_CODES.DOWN:
    case SLIDESHOW_KEY_CODES.PAGE_DOWN:
    case SLIDESHOW_KEY_CODES.UP:
    case SLIDESHOW_KEY_CODES.PAGE_UP:
      event.preventDefault();
      break;
    default:
      break;
  }

  // Scroll the contents of the current slide
  if(slideshow_currentSlide) {
    const delta = SLIDESHOW_SCROLL_DELTAS['' + event.keyCode];
    if(delta) {
      scroll_element_to(slideshow_currentSlide, delta[0],
        slideshow_currentSlide.scrollTop + delta[1]);
      return;
    }
  }

  // React to navigational commands
  switch(event.keyCode) {
    case SLIDESHOW_KEY_CODES.SPACE:
    case SLIDESHOW_KEY_CODES.RIGHT:
    case SLIDESHOW_KEY_CODES.N:
      clearTimeout(slideshow_keydown_timer);
      slideshow_keydown_timer = setTimeout(slideshow_show_next_slide, 50);
      break;
    case SLIDESHOW_KEY_CODES.LEFT:
    case SLIDESHOW_KEY_CODES.P:
      clearTimeout(slideshow_keydown_timer);
      slideshow_keydown_timer = setTimeout(slideshow_show_previous_slide, 50);
      break;
    default:
      break;
  }
}

// TODO: instead of binding this to window, bind to each slide? that way
// we don't have to use the slideshow_currentSlide hack?
window.addEventListener('keydown', slideshow_onkeydown, false);

function slideshow_init(event) {
  document.removeEventListener('DOMContentLoaded', slideshow_init);
  style_load_styles();
  slideshow_append_slides(slideshow_maybe_show_all_read, true);
}

document.addEventListener('DOMContentLoaded', slideshow_init);
