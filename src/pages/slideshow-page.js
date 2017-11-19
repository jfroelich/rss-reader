// slideshow view module

import assert from "/src/utils/assert.js";
import {formatDate} from "/src/utils/date.js";
import * as Entry from "/src/entry.js";
import {entryCSSInit, entryCSSOnChange} from "/src/entry-css.js";
import {openTab} from "/src/extension.js";
import filterPublisher from "/src/filter-publisher.js";
import {escapeHTML, truncate as htmlTruncate} from "/src/utils/html.js";
import * as rdb from "/src/rdb.js";
import entryMarkRead from "/src/entry-mark-read.js";
import {parseInt10} from "/src/utils/string.js";
import {isCanonicalURLString} from "/src/url-string.js";

// Track the currently visible slide
let currentSlide;

const settingsChannel = new BroadcastChannel('settings');
settingsChannel.onmessage = function(event) {
  if(event.data === 'changed') {
    console.debug('settings change detected');
    entryCSSOnChange(event);
  }
};

const dbChannel = new BroadcastChannel('db');
dbChannel.onmessage = function(event) {
  if(event.data && event.data.type === 'entry-archived') {
    console.log('Received archive entry request message');
  } else if(event.data && event.data.type === 'entry-deleted') {
    console.log('Received entry delete request message');
  }
};

const pollChannel = new BroadcastChannel('poll');
pollChannel.onmessage = async function(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = countUnreadSlides();
    let conn; // leave undefined

    if(count < 2) {
      try {
        conn = await rdb.open();
        appendSlides(conn);
      } catch(error) {
        console.warn(error);
      } finally {
        rdb.close(conn);
      }
    }
  }
};

function removeSlide(slideElement) {
  assert(slideElement instanceof Element);
  slideElement.removeEventListener('click', onSlideClick);
  slideElement.remove();
}

async function markSlideRead(conn, slideElement) {
  assert(rdb.isOpen(conn));

  // This is a routine situation such as when navigating backward and therefore not an error.
  if(slideElement.hasAttribute('read')) {
    return;
  }

  const slideEntryAttributeValue = slideElement.getAttribute('entry');
  const entryId = parseInt10(slideEntryAttributeValue);
  assert(Entry.isValidId(entryId));

  try {
    await entryMarkRead(conn, entryId);
  } catch(error) {
    console.warn(error);
    return;
  }

  slideElement.setAttribute('read', '');
}

// TODO: visual feedback on error
async function appendSlides(conn) {
  const limit = 3;
  let entries = [];
  const offset = countUnreadSlides();

  try {
    entries = await rdb.getUnarchivedUnreadEntries(conn, offset, limit);
  } catch(error) {
    // TODO: visual feedback in event of an error
    console.warn(error);
    return 0;
  }

  for(const entry of entries) {
    appendSlide(entry);
  }

  return entries.length;
}

// Add a new slide to the view.
function appendSlide(entry) {
  assert(Entry.isEntry(entry));

  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('div');

  // tabindex must be explicitly defined for div.focus()
  slideElement.setAttribute('tabindex', '-1');
  slideElement.setAttribute('entry', entry.id);
  slideElement.setAttribute('feed', entry.feed);
  slideElement.setAttribute('class','entry');
  slideElement.addEventListener('click', onSlideClick);
  // Bind to slide, not window, because only slide scrolls
  // TODO: look into the new 'passive' flag for scroll listeners
  slideElement.addEventListener('scroll', onSlideScroll);
  slideElement.style.position = 'absolute';

  if(containerElement.childElementCount) {
    slideElement.style.left = '100%';
    slideElement.style.right = '-100%';
  } else {
    slideElement.style.left = '0%';
    slideElement.style.right = '0%';
  }

  slideElement.style.overflowX = 'hidden';
  slideElement.style.top = '0';
  slideElement.style.bottom = '0';
  slideElement.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const titleElement = createArticleTitleElement(entry);
  slideElement.appendChild(titleElement);
  const contentElement = createArticleContentElement(entry);
  slideElement.appendChild(contentElement);
  const sourceElement = createFeedSourceElement(entry);
  slideElement.appendChild(sourceElement);

  containerElement.appendChild(slideElement);

  // TODO: this might be wrong if multiple unread slides are initially appended. I need to ensure
  // currentSlide is always set. Where do I do this?
  // TODO: clarify the above comment, I have no idea what I am talking about
  if(containerElement.childElementCount === 1) {
    currentSlide = slideElement;
    currentSlide.focus();
  }
}

function createArticleTitleElement(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', Entry.peekURL(entry));
  titleElement.setAttribute('class', 'entry-title');

  // TODO: use of _blank is discouraged. Need to use custom listener that opens new tab instead
  titleElement.setAttribute('target','_blank');

  titleElement.setAttribute('rel', 'noreferrer');

  if(entry.title) {
    let title = entry.title;
    let safeTitle = escapeHTML(title);

    // Set the attribute value to the full title without truncation or publisher filter
    titleElement.setAttribute('title', safeTitle);

    let filteredSafeTitle = filterPublisher(safeTitle);
    try {
      filteredSafeTitle = htmlTruncate(filteredSafeTitle, 300);
    } catch(error) {
      console.warn(error);
    }

    // Use innerHTML to allow entities in titles
    titleElement.innerHTML = filteredSafeTitle;

  } else {
    titleElement.setAttribute('title', 'Untitled');
    titleElement.textContent = 'Untitled';
  }

  return titleElement;
}

function createArticleContentElement(entry) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  contentElement.innerHTML = entry.content;
  return contentElement;
}

function createFeedSourceElement(entry) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class', 'entry-source');

  if(entry.faviconURLString) {
    assert(isCanonicalURLString(entry.faviconURLString));
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }
  // TODO: why is this called title? This should be renamed to something like attributionElement
  const titleElement = document.createElement('span');
  if(entry.feedLink) {
    titleElement.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.datePublished));
  }
  titleElement.textContent = buffer.join('');
  sourceElement.appendChild(titleElement);
  return sourceElement;
}

async function onSlideClick(event) {
  const CODE_LEFT_MOUSE_BUTTON = 1;
  if(event.which !== CODE_LEFT_MOUSE_BUTTON) {
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

  const urlString = anchor.getAttribute('href');
  assert(isCanonicalURLString(urlString));
  openTab(urlString);

  let conn;
  try {
    conn = await rdb.open();
    await markSlideRead(conn, currentSlide);
  } catch(error) {
    console.warn(error);
  } finally {
    rdb.close(conn);
  }

  return false;
}

// TODO: visual feedback on error
async function showNextSlide() {

  // currentSlide may be undefined. This isn't actually an error. For example, when initially
  // viewing the slideshow before subscribing when there are no feeds and entries, or initially
  // viewing the slideshow when all entries are read.
  if(!currentSlide) {
    console.warn('no current slide');
    return;
  }

  const oldSlideElement = currentSlide;
  const unreadSlideElementCount = countUnreadSlides();
  let slideAppendCount = 0;
  let conn;

  try {
    conn = await rdb.open();

    // Conditionally append more slides
    if(unreadSlideElementCount < 2) {
      slideAppendCount = await appendSlides(conn);
    }

    if(currentSlide.nextSibling) {
      currentSlide.style.left = '-100%';
      currentSlide.style.right = '100%';
      currentSlide.nextSibling.style.left = '0px';
      currentSlide.nextSibling.style.right = '0px';
      currentSlide.scrollTop = 0;
      currentSlide = currentSlide.nextSibling;

      // Change the active element to the new current slide, so that scrolling with keys works
      currentSlide.focus();

      await markSlideRead(conn, oldSlideElement);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    rdb.close(conn);
  }

  if(slideAppendCount > 0) {
    cleanupOnAppend();
  }
}

function cleanupOnAppend() {
  assert(currentSlide);
  const maxSlideCount = 6;
  const containerElement = document.getElementById('slideshow-container');
  while(containerElement.childElementCount > maxSlideCount && containerElement.firstChild !==
    currentSlide) {
    removeSlide(containerElement.firstChild);
  }
}

// Move the current slide out of view to the right, and move the previous slide into view, and then
// update the current slide.
function showPreviousSlide() {
  // TODO: when is this condition ever true? Maybe this should be an assert?
  if(!currentSlide) {
    return;
  }

  const prevSlideElement = currentSlide.previousSibling;
  if(!prevSlideElement) {
    return;
  }

  currentSlide.style.left = '100%';
  currentSlide.style.right = '-100%';
  prevSlideElement.style.left = '0';
  prevSlideElement.style.right = '0';
  currentSlide = prevSlideElement;
  // Change the active element to the new current slide, so that scrolling using keyboard keys still
  // works
  currentSlide.focus();
}

function countUnreadSlides() {
  const slides = document.body.querySelectorAll('div[entry]:not([read])');
  return slides.length;
}

let keydownTimerId = null;

function onKeyDown(event) {
  // Translate space from page down to show next slide
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  switch(code) {
  case RIGHT:
  case N:
  case SPACE: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(showNextSlide);

    break;
  }

  case LEFT:
  case P: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(showPreviousSlide);
    break;
  }
  default:
    break;
  }

}

window.addEventListener('keydown', onKeyDown);

// Override built in keyboard scrolling
let scrollCallbackHandle;
function onSlideScroll(event) {
  const DOWN = 40, UP = 38;
  function onIdleCallback() {
    const delta = event.keyCode === UP ? -200 : 200;
    document.activeElement.scrollTop += delta;
  }

  if(event.keyCode !== DOWN && event.keyCode !== UP) {
    return;
  }

  if(!document.activeElement) {
    return;
  }

  event.preventDefault();
  cancelIdleCallback(scrollCallbackHandle);
  scrollCallbackHandle = requestIdleCallback(onIdleCallback);
}

// Initialization
async function init() {
  entryCSSInit();
  let conn;
  try {
    conn = await rdb.open();
    await appendSlides(conn);
  } finally {
    rdb.close(conn);
  }
}

init().catch(console.warn);
