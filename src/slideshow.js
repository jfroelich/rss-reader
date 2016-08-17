// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Slideshow = Object.create(null);

Slideshow.currentSlide = null;

Slideshow.onMessage = function(message) {
  switch(message.type) {
    case 'pollCompleted':
      Slideshow.maybeAppendSlides();
      break;
    case 'entryDeleteRequested':
      // Not yet implemented
      break;
    case 'archiveEntryRequested':
      // Not yet implemented
      break;
    default:
      break;
  }
};

chrome.runtime.onMessage.addListener(Slideshow.onMessage);

Slideshow.removeSlide = function(slideElement) {
  slideElement.removeEventListener('click', Slideshow.onSlideClick);
  slideElement.remove();
};

Slideshow.markAsRead = function(slide) {
  if(!slide.hasAttribute('read')) {
    slide.setAttribute('read', '');
    mark_as_read(parseInt(slide.getAttribute('entry'), 10));
  }
};

Slideshow.filterArticleTitle = function(title) {
  console.assert(title, 'title is required');

  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  const trailingText = title.substring(index + 1);

  const tokens = trailingText.split(/\s+/g);

  const definedTokens = tokens.filter(function(tokenString) {
    return tokenString;
  });

  if(definedTokens.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
};

Slideshow.maybeAppendSlides = function() {
  const count = Slideshow.countUnreadSlides();
  if(count < 1) {
    const isFirst = !document.getElementById('slideshow-container').firstChild;
    Slideshow.appendSlides(Slideshow.hideAllUnreadSlides, isFirst);
  }
};

Slideshow.appendSlides = function(oncomplete, isFirst) {
  let counter = 0;
  const limit = 5;
  const offset = Slideshow.countUnreadSlides();
  let notAdvanced = true;
  open_db(onOpenDatabase);

  function onOpenDatabase(connection) {
    if(connection) {
      const transaction = connection.transaction('entry');
      const entryStore = transaction.objectStore('entry');
      const index = entryStore.index('archiveState-readState');
      const keyPath = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.UNREAD];
      const request = index.openCursor(keyPath);
      request.onsuccess = onOpenCursor;
      request.onerror = onOpenCursor;
    } else {
      // TODO: show an error?
    }
  }

  function onOpenCursor(event) {
    const cursor = event.target.result;

    if(!cursor) {
      if(oncomplete) {
        oncomplete();
      }
      return;
    }

    if(notAdvanced && offset) {
      notAdvanced = false;
      cursor.advance(offset);
      return;
    }

    Slideshow.appendSlide(cursor.value, isFirst);

    if(isFirst && counter === 0) {
      // TODO: could just directly query for the slide
      // using querySelector, which would match first slide
      // in doc order.
      Slideshow.currentSlide = document.getElementById(
        'slideshow-container').firstChild;
      isFirst = false;
    }

    if(++counter < limit) {
      cursor.continue();
    }
  }
};

Slideshow.onSlideClick = function(event) {
  const mouseButtonCode = event.which;
  const LEFT_MOUSE_BUTTON_CODE = 1;
  const MOUSE_WHEEL_BUTTON_CODE = 2;

  // Only react to left clicks
  if(mouseButtonCode !== LEFT_MOUSE_BUTTON_CODE) {
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
    //  Slideshow.onSlideClick);
    Slideshow.markAsRead(event.currentTarget);
  }

  // Prevent the normal link click behavior
  event.preventDefault();

  chrome.tabs.create({
    'active': true,
    'url': event.target.getAttribute('href')
  });

  return false;
};

// Add a new slide to the view. If isFirst is true, the slide is immediately
// visible. Otherwise, the slide is positioned off screen.
Slideshow.appendSlide = function(entry, isFirst) {
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', Slideshow.onSlideClick);

  slide.style.position = 'absolute';
  slide.style.left = isFirst ? '0%' : '100%';
  slide.style.right = isFirst ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const entryLinkURLString = Entry.prototype.getURL.call(entry);
  const title = document.createElement('a');
  title.setAttribute('href', entryLinkURLString);
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('rel', 'noreferrer');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    let titleText = entry.title;
    titleText = Slideshow.filterArticleTitle(titleText);
    titleText = truncate_html(titleText, 300);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }
  slide.appendChild(title);

  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const parser = new DOMParser();
  const entryContentDocument = parser.parseFromString(entry.content,
    'text/html');

  filter_boilerplate(entryContentDocument);
  sanitize_document(entryContentDocument);
  Slideshow.addNoReferrer(entryContentDocument);
  const entryContentBody = entryContentDocument.body ||
    entryContentDocument.documentElement;
  Slideshow.moveChildNodes(entryContentBody, content);

  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  if(entry.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    source.appendChild(faviconElement);
  }

  const feedTitleElement = document.createElement('span');
  if(entry.feedLink) {
    feedTitleElement.setAttribute('title', entry.feedLink);
  }

  const feedTitleStringBuffer = [];
  feedTitleStringBuffer.push(entry.feedTitle || 'Unknown feed');
  feedTitleStringBuffer.push(' by ');
  feedTitleStringBuffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    feedTitleStringBuffer.push(' on ');
    feedTitleStringBuffer.push(Slideshow.formatDate(entry.datePublished));
  }

  feedTitleElement.textContent = feedTitleStringBuffer.join('');
  source.appendChild(feedTitleElement);

  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.appendChild(slide);
};

// Moves the child nodes from sourceElement to destinationElement. The elements
// may be in different documents.
Slideshow.moveChildNodes = function(sourceElement, destinationElement) {
  const sourceDocument = sourceElement.ownerDocument;
  const fragment = sourceDocument.createDocumentFragment();
  for(let node = sourceElement.firstChild; node;
    node = sourceElement.firstChild) {
    fragment.appendChild(node);
  }
  destinationElement.appendChild(fragment);
};

Slideshow.formatDate = function(date, optionalDelimiterString) {
  const datePartsArray = [];
  if(date) {
    datePartsArray.push(date.getMonth() + 1);
    datePartsArray.push(date.getDate());
    datePartsArray.push(date.getFullYear());
  }
  return datePartsArray.join(optionalDelimiterString || '');
};

Slideshow.addNoReferrer = function(document) {
  const anchors = document.querySelectorAll('a');
  for(let i = 0, len = anchors.length; i < len; i++) {
    let anchor = anchors[i];
    anchor.setAttribute('rel', 'noreferrer');
  }
};

Slideshow.toURLTrapped = function(urlString) {
  try {
    return new URL(urlString);
  } catch(exception) {
  }
};

Slideshow.showNextSlide = function() {

  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.
  const unreadCount = Slideshow.countUnreadSlides();
  if(unreadCount < 2) {
    const isFirst = false;
    Slideshow.appendSlides(onAppendComplete, isFirst);
  } else {
    showNext();
  }

  function onAppendComplete() {
    // Before navigating, cleanup some of the old slides so that we do not
    // display too many slides at once.
    // Note this is very sensitive to timing, it has to occur relatively
    // quickly.
    const c = document.getElementById('slideshow-container');
    while(c.childElementCount > 10 && c.firstChild != Slideshow.currentSlide) {
      Slideshow.removeSlide(c.firstChild);
    }

    showNext();
    Slideshow.maybeShowAllReadSlide();
  }

  // Move the current slide out of view and mark it as read, and move the
  // next slide into view, and then update the global variable that tracks
  // the current slide.
  function showNext() {
    const current = Slideshow.currentSlide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      Slideshow.markAsRead(current);
      Slideshow.currentSlide = current.nextSibling;
    }
  }
};

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
Slideshow.showPreviousSlide = function() {
  const current = Slideshow.currentSlide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    Slideshow.currentSlide = current.previousSibling;
  }
};

Slideshow.countUnreadSlides = function() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
};

Slideshow.maybeShowAllReadSlide = function() {
  // Not yet implemented
};

Slideshow.hideAllUnreadSlides = function() {
  // Not yet implemented
};

Slideshow.incrementalScrollTo = function(element, deltaY, targetY) {
  let scrollYStartTimer; // debounce
  let scrollYIntervalTimer; // incrementally move
  let amountToScroll = 0;
  let amountScrolled = 0;

  function debounce() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(startScroll, 5);
  }

  function startScroll() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll === 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(doScrollToY, 20);
  }

  function doScrollToY() {
    const currentY = element.scrollTop;
    element.scrollTop += deltaY;
    amountScrolled += Math.abs(deltaY);
    if(currentY === element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }

  return debounce();
};

Slideshow.KEY_CODES = {
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

Slideshow.SCROLL_DELTAS = {};
Slideshow.SCROLL_DELTAS['' + Slideshow.KEY_CODES.DOWN] = [80, 400];
Slideshow.SCROLL_DELTAS['' + Slideshow.KEY_CODES.PAGE_DOWN] = [100, 800];
Slideshow.SCROLL_DELTAS['' + Slideshow.KEY_CODES.UP] = [-50, -200];
Slideshow.SCROLL_DELTAS['' + Slideshow.KEY_CODES.PAGE_UP] = [-100, -800];

Slideshow.keydownTimer = null;
Slideshow.onKeyDown = function(event) {
  const CODE = Slideshow.KEY_CODES;
  switch(event.keyCode) {
    case CODE.DOWN:
    case CODE.PAGE_DOWN:
    case CODE.UP:
    case CODE.PAGE_UP:
      event.preventDefault();
      if(Slideshow.currentSlide) {
        const delta = Slideshow.SCROLL_DELTAS['' + event.keyCode];
        Slideshow.incrementalScrollTo(Slideshow.currentSlide, delta[0],
          Slideshow.currentSlide.scrollTop + delta[1]);
      }
      break;
    case CODE.SPACE:
      event.preventDefault();
    case CODE.RIGHT:
    case CODE.N:
      clearTimeout(Slideshow.keydownTimer);
      Slideshow.keydownTimer = setTimeout(Slideshow.showNextSlide, 50);
      break;
    case CODE.LEFT:
    case CODE.P:
      clearTimeout(Slideshow.keydownTimer);
      Slideshow.keydownTimer = setTimeout(Slideshow.showPreviousSlide, 50);
      break;
    default:
      break;
  }
};

window.addEventListener('keydown', Slideshow.onKeyDown, false);

Slideshow.init = function(event) {
  document.removeEventListener('DOMContentLoaded', Slideshow.init);
  DisplaySettings.loadStyles();
  Slideshow.appendSlides(Slideshow.maybeShowAllReadSlide, true);
};

document.addEventListener('DOMContentLoaded', Slideshow.init);
