// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: use class 'slideRead' instead of custom attribute 'read'
// TODO: need to resolve anchors (here or somewhere else)

'use strict';

var currentSlide = null;

var VIEW_MESSAGE_HANDLER_MAP = {
  displaySettingsChanged: lucu.style.onChange,
  pollCompleted: maybeAppendMoreSlides,
  subscribe: maybeAppendMoreSlides,
  unsubscribe: viewOnUnsubscribeMessage
};

function viewDispatchMessage(message) {
  var handler = VIEW_MESSAGE_HANDLER_MAP[message.type];
  if(handler) {
    handler(message);
  }
}

chrome.runtime.onMessage.addListener(viewDispatchMessage);

function maybeAppendMoreSlides() {

  var unreadCount = countUnreadSlides();

  // There are still some unread slides loaded, so do not bother
  // appending
  if(unreadCount)
    return;

  // TODO: we do not actually need a count here, just a check
  // of whether firstElementChild is defined.
  // TODO: we can use querySelector to get the first slide
  // itself instead of getting the parent container and
  // checking its children.
  var isFirst = !document.getElementById('slideshow-container').firstChild;
  appendSlides(hideNoUnreadArticlesSlide,isFirst);
}

function viewOnUnsubscribeMessage(message) {

  var slidesForFeed = document.querySelectorAll('div[feed="'+ message.feed +'"]');
  var removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function(removedCurrent, slide) {
    // TODO: verify removing all listeners
    //slide.removeEventListener('click', onSlideClick);
    //slide.remove();
    removeSlideElement(slideElement);
    return removedCurrent || (slide == currentSlide);
  }, false);

  if(removedCurrentSlide) {
    // TODO: implement
    console.warn('Removed current slide as a result of unsubscribing but did not update UI');
  }

  maybeShowNoUnreadArticlesSlide();
}

function removeSlideElement(slideElement) {
  slideElement.removeEventListener('click', onSlideClick);
  slideElement.remove();
}

function markSlideRead(slideElement) {
  if(!slideElement)
    return;
  if(slideElement.hasAttribute('read'))
    return;
  var updateElement = HTMLElement.prototype.setAttribute.bind(slideElement,'read','');
  lucu.database.open(function(db) {
    var entryId = parseInt(slideElement.getAttribute('entry'));
    lucu.entry.markAsRead(db, entryId, updateElement);
  });
}

function appendSlides(oncomplete, isFirst) {

  // TODO: encapsulate most of this in a forEachEntry
  // function in entry.js?

  var counter = 0;
  var limit = 3;
  var offset = countUnreadSlides();
  var notAdvanced = true;

  lucu.database.open(function(db) {
    var tx = db.transaction('entry');
    tx.oncomplete = oncomplete;
    tx.objectStore('entry').index('unread').openCursor().onsuccess = renderEntry;
  });

  function renderEntry() {
    var cursor = this.result;

    if(cursor) {
      if(notAdvanced && offset) {
        notAdvanced = false;
        cursor.advance(offset);
      } else {
        appendSlide(cursor.value, isFirst);

        if(isFirst && counter == 0) {

          // TODO: could just directly query for the slide
          // using querySelector, which would match first slide
          // in doc order.
          currentSlide = document.getElementById('slideshow-container').firstChild;
          isFirst = false;
        }

        if(++counter < limit)
          cursor.continue();
      }
    }
  }
}

/**
 * React to slide clicked. Only interested in anchor clicks.
 *
 * TODO: just checking if image parent is in anchor is incorrect
 * The correct condition is if image is a descendant of an anchor
 * TODO: this should probably be the handler that determines
 * whether to open an anchor click in a new tab, instead of
 * setting a target attribute per anchor.
 *
 * NOTE: event.target is what was clicked. event.currentTarget
 * is where the listener is attached.
 */
function onSlideClick(event) {

  // TODO: this should be checking if in anchor axis, not
  // just immediate parent
  if(event.target.matches('img')) {
    if(!event.target.parentElement.matches('a')) {
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
    //event.currentTarget.removeEventListener('click', onSlideClick);

    markSlideRead(event.currentTarget);
  }

  // Prevent the normal link click behavior
  event.preventDefault();

  // Apparently opening a link in a new tab is now a complicated thing to do
  // when using plain javascript. So we are going to cheat here
  chrome.tabs.create({
    active: true,
    url: event.target.getAttribute('href')
  });

  // Prevent the normal link click behavior
  return false;
}

/**
 * Add a new slide to the view. If isFirst is true, the slide
 * is immediately visible. Otherwise, the slide is positioned
 * off screen.
 *
 * NOTE: in the current design, fetched content scrubbing is
 * done onLoad instead of onBeforeStore. This is not
 * the best performance. This is done primarily to simplify
 * development. However, it also means we can defer decisions
 * about rendering, which provides a chance to customize the
 * rendering for already stored content and not just content
 * fetched in the future. It also emphasizes that scrubbing
 * must be tuned to be fast enough not to cause lag while
 * blocking, because this is synchronous.
 *
 * TODO: looking into other performance tuning. See
 * https://developers.google.com/speed/articles/javascript-dom
 */
function appendSlide(entry, isFirst) {

  var slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', onSlideClick);

  slide.style.position='absolute';
  slide.style.left = isFirst ? '0%' : '100%';
  slide.style.right = isFirst ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  var title = document.createElement('a');
  title.setAttribute('href', entry.link);
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    var titleText = lucu.stripTags(entry.title);
    titleText = lucu.truncate(titleText, 200);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  var content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  // TODO: this should be using parseHTML
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = entry.content;

  // TODO: is this worthwhile? seems out of place
  lucu.trimDocument(doc);

  // TODO: all anchors should open in new window?

  var calamineOptions = { FILTER_ATTRIBUTES: true, UNWRAP_UNWRAPPABLES: true };
  var results = calamine.transformDocument(doc, calamineOptions);

  Array.prototype.forEach.call(results.childNodes,
    HTMLElement.prototype.appendChild.bind(content));

  slide.appendChild(content);

  var source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  var favIcon = document.createElement('img');
  favIcon.setAttribute('src', lucu.getFavIconURL(entry.feedLink || entry.baseURI));
  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  var feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  var entryPubDate = entry.pubdate ?
    ' on ' + lucu.formatDate(new Date(entry.pubdate)) : '';
  feedTitle.textContent = (entry.feedTitle || 'Unknown feed') + ' by ' +
    (entry.author || 'Unknown author') + entryPubDate;
  source.appendChild(feedTitle);

  document.getElementById('slideshow-container').appendChild(slide);
}

function showNextSlide() {

  if(countUnreadSlides() < 2) {
    appendSlides(function() {

        // TODO: this is still producing UI latency
        var c = document.getElementById('slideshow-container');
        while(c.childElementCount > 30 && c.firstChild != currentSlide) {
          removeSlideElement(c.firstChild);
        }

        showNext();
        maybeShowNoUnreadArticlesSlide();
    }, false);
  } else {
    showNext();
  }

  function showNext() {
    var current = currentSlide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      markSlideRead(current);
      currentSlide = current.nextSibling;
    }
  }
}

function showPreviousSlide() {
  var current = currentSlide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    currentSlide = current.previousSibling;
  }
}

function isEntryElementUnread(entryElement) {
  return !entryElement.hasAttribute('read');
}

function countUnreadSlides() {
  var slides = document.body.querySelectorAll('div[entry]:not([read])');
  return slides ? slides.length : 0;
}

function maybeShowNoUnreadArticlesSlide() {
  var numUnread = countUnreadSlides();

  if(numUnread) {
    return;
  }

  console.warn('not implemented');
}

function hideNoUnreadArticlesSlide() {
  console.warn('not implemented');
}

var keyDownTimer;

function onKeyDown(event) {
  //event.target is body
  //event.currentTarget is window

  // TODO: this does not belong here
  var KEY = {
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    N: 78,
    P: 80
  };

  var key = event.keyCode;

  if(key == KEY.SPACE || key == KEY.DOWN || key == KEY.PAGE_DOWN ||
      key == KEY.UP || key == KEY.PAGE_UP) {
    event.preventDefault();
  }

  // TODO: lot of DRY violation here. I should use a {} map
  // to deltas and make one call to animatedScrollTo instead

  if(currentSlide) {
    if(key == KEY.DOWN) {
      animatedScrollTo(currentSlide, 50, currentSlide.scrollTop + 200)
      return;
    } else if(key == KEY.PAGE_DOWN) {
      animatedScrollTo(currentSlide, 100, currentSlide.scrollTop + 800);
      return;
    } else if(key == KEY.UP) {
      animatedScrollTo(currentSlide, -50, currentSlide.scrollTop - 200);
      return;
    } else if(key == KEY.PAGE_UP) {
      animatedScrollTo(currentSlide, -100, currentSlide.scrollTop - 800);
      return;
    }
  }

  if(key == KEY.SPACE || key == KEY.RIGHT || key == KEY.N) {
    clearTimeout(keyDownTimer);
    keyDownTimer = setTimeout(showNextSlide, 50);
  } else if(key == KEY.LEFT || key == KEY.P) {
    clearTimeout(keyDownTimer);
    keyDownTimer = setTimeout(showPreviousSlide, 50);
  }
}

/**
 * Periodically scroll from the current position to a new position
 *
 * NOTE: the start timer is basically to debounce calls to this function
 * whereas the interval timer is to track the interval and stop it when
 * finished
 *
 * TODO: break apart into functions
 *
 * @param element {Element} the element to scroll
 * @param delta {int} the amount of pixels by which to scroll per increment
 * @param targetY {int} the desired vertical end position
 */
function animatedScrollTo(element, delta, targetY) {
  var scrollYStartTimer;
  var scrollYIntervalTimer;
  var amountToScroll = 0;
  var amountScrolled = 0;

  return function() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(start,5);
  }();

  function start() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll == 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(scrollToY,20);
  }

  function scrollToY() {
    var currentY = element.scrollTop;
    element.scrollTop += delta;
    amountScrolled += Math.abs(delta);

    // If there was no change or we scrolled too far, then we are done.
    if(currentY == element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }
}

// TODO: instead of binding this to window, bind to each slide? that way
// we don't have to use the currentSlide hack?
window.addEventListener('keydown', onKeyDown, false);

function initSlideShow(event) {
  document.removeEventListener('DOMContentLoaded', initSlideShow);
  lucu.style.onLoad();
  appendSlides(maybeShowNoUnreadArticlesSlide, true);
}

document.addEventListener('DOMContentLoaded', initSlideShow);