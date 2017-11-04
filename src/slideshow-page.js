'use strict';

// import base/assert.js
// import base/indexeddb.js
// import article-title.js
// import entry-css.js
// import entry-mark-read.js
// import reader-db.js

// TODO: add assertions and logging
// TODO: use statuses instead of exceptions


let slideshowCurrentSlide = null;

const slideshowSettingsChannel = new BroadcastChannel('settings');
slideshowSettingsChannel.onmessage = function(event) {
  if(event.data === 'changed') {
    console.debug('settings change detected');
    entryCSSOnChange(event);
  }
};

const slideshowDBChannel = new BroadcastChannel('db');
slideshowDBChannel.onmessage = function(event) {
  if(event.data && event.data.type === 'entry-archived') {
    console.log('Received archive entry request message');
  } else if(event.data && event.data.type === 'entry-deleted') {
    console.log('Received entry delete request message');
  }
};

const slideshowPollChannel = new BroadcastChannel('poll');
slideshowPollChannel.onmessage = function(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = slideshowCountUnreadSlides();
    let conn; // leave undefined
    if(count < 2) {
      slideshowAppendSlides(conn);
    }
  }
};

function slideshowSlideRemove(slideElement) {
  slideElement.removeEventListener('click', slideshowSlideOnclick);
  slideElement.remove();
}

// TODO: visual feedback in event of an error
async function slideshowSlideMarkRead(conn, slideElement) {
  assert(indexedDBIsOpen(conn));

  // not an error
  if(slideElement.hasAttribute('read')) {
    return;
  }

  const entryIdString = slideElement.getAttribute('entry');
  const RADIX = 10;
  const entryIdNumber = parseInt(entryIdString, RADIX);
  try {
    await readerStorageMarkRead(conn, entryIdNumber);
  } catch(error) {
    // TODO: handle error visually
    console.warn(error);
    return;
  }

  slideElement.setAttribute('read', '');
}

// TODO: do not support local conn
// TODO: require caller to establish conn, do not do it here
// TODO: visual feedback on error
async function slideshowAppendSlides(conn) {
  const limit = 3;
  let isLocalConn = false;
  let entries = [];

  const offset = slideshowCountUnreadSlides();

  try {
    if(!conn) {
      conn = await readerDbOpen();
      isLocalConn = true;
    }

    entries = await readerDbGetUnarchivedUnreadEntries(conn, offset, limit);
  } catch(error) {
    console.warn(error);
  } finally {
    if(isLocalConn) {
      indexedDBClose(conn);
    }
  }

  for(const entry of entries) {
    slideshowAppendSlide(entry);
  }

  return entries.length;
}

// Add a new slide to the view.
function slideshowAppendSlide(entry) {
  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('div');

  // tabindex must be explicitly defined for div.focus()
  slideElement.setAttribute('tabindex', '-1');
  slideElement.setAttribute('entry', entry.id);
  slideElement.setAttribute('feed', entry.feed);
  slideElement.setAttribute('class','entry');
  slideElement.addEventListener('click', slideshowSlideOnclick);
  // Bind to slide, not window, because only slide scrolls
  // TODO: look into the new 'passive' flag for scroll listeners
  slideElement.addEventListener('scroll', slideshowSlideOnscroll);
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

  const titleElement = slideshowCreateArticleTitleElement(entry);
  slideElement.appendChild(titleElement);
  const contentElement = slideshowCreateArticleContentElement(entry);
  slideElement.appendChild(contentElement);
  const sourceElement = slideshowCreateFeedSourceElement(entry);
  slideElement.appendChild(sourceElement);

  containerElement.appendChild(slideElement);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure slideshowCurrentSlide is always set. Where do I do this?
  if(containerElement.childElementCount === 1) {
    slideshowCurrentSlide = slideElement;
    slideshowCurrentSlide.focus();
  }
}

function slideshowCreateArticleTitleElement(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', entryPeekURL(entry));
  titleElement.setAttribute('class', 'entry-title');
  titleElement.setAttribute('target','_blank');
  titleElement.setAttribute('rel', 'noreferrer');
  titleElement.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    titleElement.setAttribute('title', entry.title);
    let titleText = entry.title;
    titleText = articleTitleFilterPublisher(titleText);

    // TODO: handle ParseError correctly
    titleText = htmlTruncate(titleText, 300);
    titleElement.innerHTML = titleText;
  } else {
    titleElement.setAttribute('title', 'Untitled');
    titleElement.textContent = 'Untitled';
  }

  return titleElement;
}

function slideshowCreateArticleContentElement(entry) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  contentElement.innerHTML = entry.content;
  return contentElement;
}

function slideshowCreateFeedSourceElement(entry) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class','entrysource');

  if(entry.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }

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
    buffer.push(dateFormat(entry.datePublished));
  }
  titleElement.textContent = buffer.join('');
  sourceElement.appendChild(titleElement);

  return sourceElement;
}

async function slideshowSlideOnclick(event) {
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

  const urlString = anchor.getAttribute('href');
  // TODO: call to function in extension.js
  chrome.tabs.create({active: true, url: urlString});

  let conn;
  try {
    conn = await readerDbOpen();
    await slideshowSlideMarkRead(conn, slideshowCurrentSlide);
  } catch(error) {
    console.warn(error);
  } finally {
    indexedDBClose(conn);
  }

  return false;
}

// TODO: visual feedback on error
async function slideshowShowNextSlide() {

  // slideshowCurrentSlide may be undefined
  // This isn't actually an error. For example, when initially viewing the
  // slideshow before subscribing when there are no feeds and entries, or
  // initially viewing the slideshow when all entries are read.
  if(!slideshowCurrentSlide) {
    console.warn('No current slide');
    return;
  }

  const oldSlideElement = slideshowCurrentSlide;
  const unreadSlideElementCount = slideshowCountUnreadSlides();
  let slideAppendCount = 0;
  let conn;

  try {
    conn = await readerDbOpen();

    // Conditionally append more slides
    if(unreadSlideElementCount < 2)
      slideAppendCount = await slideshowAppendSlides(conn);

    if(slideshowCurrentSlide.nextSibling) {
      slideshowCurrentSlide.style.left = '-100%';
      slideshowCurrentSlide.style.right = '100%';
      slideshowCurrentSlide.nextSibling.style.left = '0px';
      slideshowCurrentSlide.nextSibling.style.right = '0px';
      slideshowCurrentSlide.scrollTop = 0;
      slideshowCurrentSlide = slideshowCurrentSlide.nextSibling;

      // Change the active element to the new current slide, so that scrolling
      // with keys works
      slideshowCurrentSlide.focus();

      // Must be awaited
      await slideshowSlideMarkRead(conn, oldSlideElement);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    indexedDBClose(conn);
  }

  if(slideAppendCount > 0) {
    slideshowCleanupOnAppend();
  }
}

function slideshowCleanupOnAppend() {
  // Weakly assert as this is trivial
  assert(slideshowCurrentSlide, 'slideshowCurrentSlide is undefined');

  const maxSlideCount = 6;
  const containerElement = document.getElementById('slideshow-container');
  while(containerElement.childElementCount > maxSlideCount &&
    containerElement.firstChild !== slideshowCurrentSlide)
    slideshowSlideRemove(containerElement.firstChild);
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function slideshowShowPreviousSlide() {
  if(!slideshowCurrentSlide) {
    return;
  }

  const prevSlideElement = slideshowCurrentSlide.previousSibling;
  if(!prevSlideElement) {
    return;
  }

  slideshowCurrentSlide.style.left = '100%';
  slideshowCurrentSlide.style.right = '-100%';
  prevSlideElement.style.left = '0px';
  prevSlideElement.style.right = '0px';
  slideshowCurrentSlide = prevSlideElement;
  // Change the active element to the new current slide, so that scrolling
  // using keyboard keys still works
  slideshowCurrentSlide.focus();
}

function slideshowCountUnreadSlides() {
  const slides = document.body.querySelectorAll('div[entry]:not([read])');
  return slides.length;
}

let keydownTimerId = null;
window.addEventListener('keydown', function slideshowOnKeyDown(event) {
  // Redefine space from page down to navigate next
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  // TODO: use switch

  if(code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(slideshowShowNextSlide);
  } else if(code === LEFT || code === P) {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(slideshowShowPreviousSlide);
  }
});

// Override built in keyboard scrolling
let slideshowScrollCallbackHandle;
function slideshowSlideOnscroll(event) {
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
  cancelIdleCallback(slideshowScrollCallbackHandle);
  slideshowScrollCallbackHandle = requestIdleCallback(onIdleCallback);
}

async function slideshowOnDOMContentLoaded(event) {
  console.debug('slideshowOnDOMContentLoaded');
  entryCSSInit();
  let conn;
  try {
    await slideshowAppendSlides(conn);
  } catch(error) {
    console.warn(error);
  }
}

document.addEventListener('DOMContentLoaded', slideshowOnDOMContentLoaded,
  {once: true});
