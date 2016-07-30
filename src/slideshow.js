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
    case 'subscribe':
      Slideshow.maybeAppendSlides();
      break;

    // NOTE: I believe this was deprecated
    //case 'unsubscribe':
    //  Slideshow.onUnsubscribe();
    //  break;
    case 'entryDeleteRequestedByUnsubscribe':
      console.debug('Reaction to removal of entry %s not yet implemented',
        message.entryId);
      break;
    case 'archiveEntryRequested':
      // TODO: react to the request, the entry may be present in the view
      break;
    default:
      // Ignore the message
      break;
  }
};

chrome.runtime.onMessage.addListener(Slideshow.onMessage);

Slideshow.onUnsubscribe = function(message) {
  const slidesForFeed = document.querySelectorAll(
    'div[feed="'+ message.feed +'"]');
  const removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function removeAndCheck(removedCurrent, slide) {
    // TODO: verify removing all listeners
    Slideshow.removeSlide(slide);
    return removedCurrent || (slide === Slideshow.currentSlide);
  }, false);

  if(removedCurrentSlide) {
    // TODO: implement
    console.warn('Removed current slide as a result of unsubscribing but did'+
      ' not update UI');
  }

  Slideshow.maybeShowAllReadSlide();
};

Slideshow.removeSlide = function(slideElement) {
  slideElement.removeEventListener('click', Slideshow.onSlideClick);
  slideElement.remove();
};

Slideshow.markAsRead = function(slide) {
  if(slide.hasAttribute('read')) {
    return;
  }

  // NOTE: using removeAttribute results in a bug, I am not sure why. In other
  // words, this must retain the attribute.
  slide.setAttribute('read', '');

  const entryIdString = slide.getAttribute('entry');
  const entryId = parseInt(entryIdString, 10);

  const feedCache = new FeedCache();
  feedCache.markEntryAsRead(entryId);
};

Slideshow.maybeAppendSlides = function() {
  const unreadCount = Slideshow.countUnreadSlides();

  // When there are unread slides still present, cancel the append
  if(unreadCount) {
    return;
  }

  // TODO: we can use querySelector to get the first slide
  // itself instead of getting the parent container and
  // checking its children.
  // TODO: we do not actually need a count here, just a check
  // of whether firstElementChild is defined.

  const isFirst = !document.getElementById('slideshow-container').firstChild;
  Slideshow.appendSlides(Slideshow.hideAllUnreadSlides, isFirst);
};

Slideshow.appendSlides = function(oncomplete, isFirst) {

  const feedCache = new FeedCache();

  let counter = 0;
  const limit = 5;
  const offset = Slideshow.countUnreadSlides();
  let notAdvanced = true;
  feedCache.open(onOpenDatabase);

  function onOpenDatabase(connection) {
    if(connection) {
      feedCache.openUnreadUnarchivedEntryCursor(connection, onOpenCursor);
    } else {
      // TODO: show an error?
      console.debug(event);
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

// TODO: just checking if image parent is in anchor is incorrect
// The correct condition is if image is a descendant of an anchor, use
// closest instead of parentNode
// TODO: this should probably be the handler that determines
// whether to open an anchor click in a new tab, instead of
// setting a target attribute per anchor.
// NOTE: event.target is what was clicked. event.currentTarget is where the
// listener is attached.
Slideshow.onSlideClick = function(event) {
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
// NOTE: in the current design, fetched content scrubbing is done onLoad
// instead of onBeforeStore. This is not the best performance. This is done
// primarily to simplify development. However, it also means we can defer
// decisions about rendering, which provides a chance to customize the
// rendering for already stored content and not just content fetched in the
// future. It also emphasizes that scrubbing must be tuned to be fast enough
// not to cause lag while blocking, because this is synchronous.
// TODO: use <article> instead of div
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

  // The entry was loaded directly from the database, so urls are strings.
  // Grab the most recent link, that is the most current, after redirects
  // and rewrites
  const entryLinkURLString = Entry.prototype.getURL.call(entry);

  // todo: rename title variable

  const title = document.createElement('a');
  title.setAttribute('href', entryLinkURLString);

  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('rel', 'noreferrer');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {

    // TODO: deal with entities appearing in the title. E.g. I am seeing
    // &amp; in plain text in the displayed title.
    // Maybe I need to use innerHTML and maybe I also then need to do more
    // sanitization of the title
    // NOTE: tags were removed pre-storage

    let titleText = entry.title;
    titleText = filterArticleTitle(titleText);
    titleText = truncateHTMLString(titleText, 300);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  // TODO: use section instead of span
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const parser = new DOMParser();
  const entryContentDocument = parser.parseFromString(entry.content,
    'text/html');

  Calamine.removeBoilerplate(entryContentDocument);
  DOMAid.cleanDocument(entryContentDocument);
  Slideshow.addNoReferrer(entryContentDocument);
  const entryContentBody = entryContentDocument.body ||
    entryContentDocument.documentElement;
  moveChildNodes(entryContentBody, content);

  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  // Append the favicon image if available
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

  const titleTextArray = [];
  titleTextArray.push(entry.feedTitle || 'Unknown feed');
  titleTextArray.push(' by ');
  titleTextArray.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    titleTextArray.push(' on ');
    titleTextArray.push(formatDate(entry.datePublished));
  }

  feedTitleElement.textContent = titleTextArray.join('');
  source.appendChild(feedTitleElement);

  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.appendChild(slide);
};

// I would rather do this at the time of storing, but attributes are filtered
// In order to move it i have to refactor that
// Current based on the following post:
// https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-
// and-more-about-controlling-the-referer-header/
// http://w3c.github.io/html/links.html#link-type-noreferrer
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

  //console.debug('Showing next slide');

  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.

  const unreadCount = Slideshow.countUnreadSlides();
  if(unreadCount < 2) {
    const isFirst = false;
    Slideshow.appendSlides(onAppendComplete, isFirst);
  } else {
    // There are still unread slides. Just go to the next one.
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

Slideshow.isUnreadyEntrySlide = function(entryElement) {
  return !entryElement.hasAttribute('read');
};

Slideshow.countUnreadSlides = function() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
};

// If no slides are loaded, or all slides are read, then show the default
// slide.
Slideshow.maybeShowAllReadSlide = function() {
  const numUnread = Slideshow.countUnreadSlides();
  if(numUnread) {
    return;
  }

  console.warn('maybeShowAllReadSlide not implemented');
};

Slideshow.hideAllUnreadSlides = function() {
  console.warn('hideAllUnreadSlides not implemented');
};

Slideshow.keydownTimer = null;

// Handle key presses. Although I would prefer the browser managed the scroll
// response, there is a strange issue with scrolling down on an article moved
// into view if I do not explicitly handle it here because it is an inner
// element that does not I think have focus, so the down arrow otherwise has no
// effect.
//event.target is body
//event.currentTarget is window
Slideshow.onKeyDown = function(event) {

  //console.debug('Key down:', event.code);

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

  // Prevent the default behavior for certain keys
  switch(event.keyCode) {
    case KEY_CODES.SPACE:
    case KEY_CODES.DOWN:
    case KEY_CODES.PAGE_DOWN:
    case KEY_CODES.UP:
    case KEY_CODES.PAGE_UP:
      event.preventDefault();
      break;
    default:
      break;
  }

  const SCROLL_DELTAS = {
    '40': [80, 400],
    '34': [100, 800],
    '38': [-50, -200],
    '33': [-100, -800]
  };

  // Scroll the contents of the current slide
  if(Slideshow.currentSlide) {
    const delta = SCROLL_DELTAS['' + event.keyCode];
    if(delta) {
      scrollToY(Slideshow.currentSlide, delta[0],
        Slideshow.currentSlide.scrollTop + delta[1]);
      return;
    }
  }

  // TODO: maybe I should always be clearing both keydown timers? I need to
  // test more when spamming left right

  // React to navigational commands
  switch(event.keyCode) {
    case KEY_CODES.SPACE:
    case KEY_CODES.RIGHT:
    case KEY_CODES.N:
      clearTimeout(Slideshow.keydownTimer);
      Slideshow.keydownTimer = setTimeout(Slideshow.showNextSlide, 50);
      break;
    case KEY_CODES.LEFT:
    case KEY_CODES.P:
      clearTimeout(Slideshow.keydownTimer);
      Slideshow.keydownTimer = setTimeout(Slideshow.showPreviousSlide, 50);
      break;
    default:
      break;
  }
};

// TODO: instead of binding this to window, bind to each slide? That way
// we don't have to use a global tracking variable like Slideshow.currentSlide,
// which feels hackish.
window.addEventListener('keydown', Slideshow.onKeyDown, false);

Slideshow.init = function(event) {
  document.removeEventListener('DOMContentLoaded', Slideshow.init);
  DisplaySettings.loadStyles();
  Slideshow.appendSlides(Slideshow.maybeShowAllReadSlide, true);
};

document.addEventListener('DOMContentLoaded', SlideShow.init);
