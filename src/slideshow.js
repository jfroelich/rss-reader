// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

let currentSlideElement = null;

chrome.runtime.onMessage.addListener(function(message) {
  switch(message.type) {
    case 'pollCompleted':
      maybeAppendSlides();
      break;
    case 'deleteEntryRequested':
      break;
    case 'archiveEntryPending':
      break;
    default:
      break;
  }
});

function removeSlide(slide) {
  slide.removeEventListener('click', slideOnClick);
  slide.remove();
}

function markSlideAsRead(slide) {
  if(!slide.hasAttribute('read')) {
    slide.setAttribute('read', '');
    markEntryAsRead(parseInt(slide.getAttribute('entry'), 10));
  }
}

function maybeAppendSlides() {
  const count = countUnreadSlides();
  if(count < 1) {
    const isFirstSlide = !document.getElementById(
      'slideshow-container').firstChild;
    appendSlides(hideUnreadSlides, isFirstSlide);
  }
}

// TODO: even though this is the only place this is called, it really does
// not belong here. The UI should not be communicating directly with the
// database. I need to design a paging API for iterating over these entries
// and the UI should be calling that paging api.
// TODO: this is a giant function, break it up into smaller functions
function appendSlides(onAppendComplete, isFirstSlide) {
  let counter = 0;
  const limit = 3;
  const offset = countUnreadSlides();

  // TODO: invert this, and the condition where it is used, to isAdvanced
  let isNotAdvanced = true;
  rdr.openDB(onOpenDB);

  function onOpenDB(connection) {
    if(connection) {
      const transaction = connection.transaction('entry');
      const entryStore = transaction.objectStore('entry');
      const index = entryStore.index('archiveState-readState');
      const key_path = [rdr.entry.flags.UNARCHIVED, rdr.entry.flags.UNREAD];
      const request = index.openCursor(key_path);
      request.onsuccess = onOpenCursor;
      request.onerror = onOpenCursor;
    } else {
      // TODO: show an error?
    }
  }

  function onOpenCursor(event) {
    const cursor = event.target.result;

    if(!cursor) {
      if(onAppendComplete) {
        onAppendComplete();
      }
      return;
    }

    if(isNotAdvanced && offset) {
      isNotAdvanced = false;
      cursor.advance(offset);
      return;
    }

    const entry = cursor.value;

    appendSlide(entry, isFirstSlide);

    if(isFirstSlide && counter === 0) {
      // TODO: could just directly query for the slide using querySelector,
      // which would match first slide in doc order.
      currentSlideElement = document.getElementById(
        'slideshow-container').firstChild;
      isFirstSlide = false;
    }

    if(++counter < limit) {
      cursor.continue();
    }
  }
}


// Add a new slide to the view. If isFirstSlide is true, the slide is
// immediately visible. Otherwise, the slide is positioned off screen.
function appendSlide(entry, isFirstSlide) {
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', slideOnClick);
  slide.style.position = 'absolute';
  slide.style.left = isFirstSlide ? '0%' : '100%';
  slide.style.right = isFirstSlide ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const title = createEntryTitle(entry);
  slide.appendChild(title);

  const content = createEntryContent(entry);
  slide.appendChild(content);

  const source = createFeedSource(entry);
  slide.appendChild(source);
  const container = document.getElementById('slideshow-container');
  container.appendChild(slide);
}

function createEntryTitle(entry) {
  const title = document.createElement('a');
  title.setAttribute('href', rdr.entry.getURL(entry));
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('rel', 'noreferrer');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    title.setAttribute('title', entry.title);
    let titleText = entry.title;
    titleText = rdr.entry.filterTitle(titleText);
    titleText = rdr.html.truncate(titleText, 300);
    title.innerHTML = titleText;
  } else {
    title.setAttribute('title', 'Untitled');
    title.textContent = 'Untitled';
  }

  return title;
}

function createEntryContent(entry) {
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  // This is the slowest line. Is there anyway to speed this up?
  // <html><body> will be implicitly stripped
  content.innerHTML = entry.content;

  return content;
}

function createFeedSource(entry) {
  const source = document.createElement('span');
  source.setAttribute('class','entrysource');

  if(entry.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    source.appendChild(faviconElement);
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
    buffer.push(rdr.formatDate(entry.datePublished));
  }

  titleElement.textContent = buffer.join('');
  source.appendChild(titleElement);

  return source;
}


const leftMouseButtonCode = 1;
const mouseWheelButtonCode = 2;

function slideOnClick(event) {
  const button_code = event.which;

  // Only react to left clicks
  if(button_code !== leftMouseButtonCode) {
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
    //  slideOnClick);
    markSlideAsRead(event.currentTarget);
  }

  // Prevent the normal link click behavior
  event.preventDefault();

  chrome.tabs.create({
    'active': true,
    'url': event.target.getAttribute('href')
  });

  return false;
}

function gotoNextSlide() {
  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.
  const unreadCount = countUnreadSlides();
  if(unreadCount < 2) {
    const isFirstSlide = false;
    appendSlides(onAppendComplete, isFirstSlide);
  } else {
    showNext();
  }

  function onAppendComplete() {
    // Before navigating, cleanup some of the old slides so that we do not
    // display too many slides at once.
    // Note this is very sensitive to timing, it has to occur relatively
    // quickly.
    const c = document.getElementById('slideshow-container');
    while(c.childElementCount > 6 && c.firstChild != currentSlideElement) {
      removeSlide(c.firstChild);
    }

    showNext();
    maybeShowAllReadSlide();
  }

  // Move the current slide out of view and mark it as read, and move the
  // next slide into view, and then update the global variable that tracks
  // the current slide.
  function showNext() {
    const current = currentSlideElement;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      markSlideAsRead(current);
      currentSlideElement = current.nextSibling;
    }
  }
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function gotoPreviousSlide() {
  const current = currentSlideElement;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    currentSlideElement = current.previousSibling;
  }
}

function countUnreadSlides() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
}

function maybeShowAllReadSlide() {
  // Not yet implemented
}

function hideUnreadSlides() {
  // Not yet implemented
}

const keyCodes = {
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

const scrollDeltas = {};
scrollDeltas['' + keyCodes.DOWN] = [80, 400];
scrollDeltas['' + keyCodes.PAGE_DOWN] = [100, 800];
scrollDeltas['' + keyCodes.UP] = [-50, -200];
scrollDeltas['' + keyCodes.PAGE_UP] = [-100, -800];

let keyDownTimerId = null;

function onKeyDown(event) {
  switch(event.keyCode) {
    case keyCodes.DOWN:
    case keyCodes.PAGE_DOWN:
    case keyCodes.UP:
    case keyCodes.PAGE_UP:
      event.preventDefault();
      if(currentSlideElement) {
        const delta = scrollDeltas['' + event.keyCode];
        rdr.smoothScrollTo(currentSlideElement, delta[0],
          currentSlideElement.scrollTop + delta[1]);
      }
      break;
    case keyCodes.SPACE:
      event.preventDefault();
    case keyCodes.RIGHT:
    case keyCodes.N:
      clearTimeout(keyDownTimerId);
      keyDownTimerId = setTimeout(gotoNextSlide, 50);
      break;
    case keyCodes.LEFT:
    case keyCodes.P:
      clearTimeout(keyDownTimerId);
      keyDownTimerId = setTimeout(gotoPreviousSlide, 50);
      break;
    default:
      break;
  }
}

// I am expressly using window here to make it clear where the listener is
// attached
window.addEventListener('keydown', onKeyDown, false);

function initSlides(event) {
  document.removeEventListener('DOMContentLoaded', initSlides);
  DisplaySettings.loadStyles();
  appendSlides(maybeShowAllReadSlide, true);
}

document.addEventListener('DOMContentLoaded', initSlides);

} // End file block scope
