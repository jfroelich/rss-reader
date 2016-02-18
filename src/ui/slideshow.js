// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

let currentSlide = null;

chrome.runtime.onMessage.addListener(function(message) {
  const type = message.type;
  if(type === 'pollCompleted') {
    maybeAppendMoreSlides();
  } else if(type === 'subscribe') {
    maybeAppendMoreSlides();
  } else if(type === 'unsubscribe') {
    onUnsubscribeMessage();
  } else if(type === 'archivedEntry') {
    // TODO: react to the archiving an entry that is read
    // and still loaded into the view
    // message.entry is the archived entry
  }
});

function maybeAppendMoreSlides() {
  const unreadCount = countUnreadSlides();

  // There are still some unread slides loaded, so do not bother
  // appending
  if(unreadCount) {
    return;
  }

  // TODO: we do not actually need a count here, just a check
  // of whether firstElementChild is defined.
  // TODO: we can use querySelector to get the first slide
  // itself instead of getting the parent container and
  // checking its children.
  const isFirst = !document.getElementById('slideshow-container').firstChild;
  appendSlides(hideNoUnreadArticlesSlide, isFirst);
}

function onUnsubscribeMessage(message) {
  const slidesForFeed = document.querySelectorAll(
    'div[feed="'+ message.feed +'"]');
  const removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function(removedCurrent, slide) {
    // TODO: verify removing all listeners
    removeSlideElement(slide);
    return removedCurrent || (slide === currentSlide);
  }, false);

  if(removedCurrentSlide) {
    // TODO: implement
    console.warn('Removed current slide as a result of unsubscribing but did'+
      ' not update UI');
  }

  maybeShowNoUnreadArticlesSlide();
}

function removeSlideElement(slideElement) {
  slideElement.removeEventListener('click', onSlideClick);
  slideElement.remove();
}

function markSlideRead(slide) {
  if(slide.hasAttribute('read')) {
    return;
  }

  slide.setAttribute('read', '');
  const entryAttribute = slide.getAttribute('entry');

  openIndexedDB(function(event) {
    if(event.type !== 'success') {
      // TODO: react to database error?
      console.debug(event);
      return;
    }

    const entryId = parseInt(entryAttribute);
    const connection = event.target.result;
    markEntryAsRead(connection, entryId);
  });
}

function appendSlides(oncomplete, isFirst) {
  let counter = 0;
  const limit = 3;
  const offset = countUnreadSlides();
  let notAdvanced = true;

  openIndexedDB(function(event) {
    if(event.type !== 'success') {
      // TODO: react?
      console.debug(event);
      return;
    }
    const connection = event.target.result;
    const transaction = connection.transaction('entry');
    transaction.oncomplete = oncomplete;
    const entryStore = transaction.objectStore('entry');

    // Load all articles that are unread and unarchived
    // TODO: this has to be sorted, but I think I will do that
    // in the next major revision

    const index = entryStore.index('archiveState-readState');
    const range = IDBKeyRange.only([EntryStore.UNARCHIVED,
      EntryStore.UNREAD]);
    const request = index.openCursor(range);
    request.onsuccess = renderEntry;
  });

  function renderEntry() {
    const cursor = this.result;

    if(cursor) {
      if(notAdvanced && offset) {
        notAdvanced = false;
        cursor.advance(offset);
      } else {
        appendSlide(cursor.value, isFirst);

        if(isFirst && counter === 0) {

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
  if(event.which !== 1) {
    return false;
  }

  // BUG: when clicking on an image in a link, it is still a link
  // click that should open the link in a new window...

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
 */
function appendSlide(entry, isFirst) {
  // TODO: use <article> instead of div
  const slide = document.createElement('div');
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

  const title = document.createElement('a');
  title.setAttribute('href', entry.link);
  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    let titleText = utils.replaceHTML(entry.title);
    titleText = filterArticleTitle(titleText);
    titleText = utils.truncateString(titleText, 300);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  // TODO: use section instead of span
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const doc = utils.parseHTML(entry.content);
  prepareDocumentForView(doc);

  if(doc.documentElement) {
    if(doc.body) {
      content.innerHTML = doc.body.innerHTML;
    } else {
      content.innerHTML = doc.documentElement.innerHTML;
    }
  }
  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  const favIcon = document.createElement('img');
  const iconSource = FavIcon.getURL(entry.feedLink);
  favIcon.setAttribute('src', iconSource);
  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  const feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  const entryPubDate = entry.pubdate ?
    ' on ' + utils.formatDate(new Date(entry.pubdate)) : '';
  feedTitle.textContent = (entry.feedTitle || 'Unknown feed') + ' by ' +
    (entry.author || 'Unknown author') + entryPubDate;
  source.appendChild(feedTitle);

  document.getElementById('slideshow-container').appendChild(slide);
}

function showNextSlide() {
  if(countUnreadSlides() < 2) {
    appendSlides(function() {
      const c = document.getElementById('slideshow-container');
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
    const current = currentSlide;
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
  const current = currentSlide;
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
  const slides = document.body.querySelectorAll('div[entry]:not([read])');
  return slides ? slides.length : 0;
}

function maybeShowNoUnreadArticlesSlide() {
  const numUnread = countUnreadSlides();
  if(numUnread) {
    return;
  }

  console.warn('maybeShowNoUnreadArticlesSlide not implemented');
}

function hideNoUnreadArticlesSlide() {
  console.warn('hideNoUnreadArticlesSlide not implemented');
}

let keyDownTimer;
// TODO: instead of binding this to window, bind to each slide? that way
// we don't have to use the currentSlide hack?
const KEY_MAP = {
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

function onKeyDown(event) {
  //event.target is body
  //event.currentTarget is window
  const key = event.keyCode;
  const km = KEY_MAP;

  if(key === km.SPACE || key === km.DOWN || key === km.PAGE_DOWN ||
      key === km.UP || key === km.PAGE_UP) {
    event.preventDefault();
  }

  if(currentSlide) {
    if(key === km.DOWN) {
      scrollElementTo(currentSlide, 50, currentSlide.scrollTop + 200)
      return;
    } else if(key === km.PAGE_DOWN) {
      scrollElementTo(currentSlide, 100, currentSlide.scrollTop + 800);
      return;
    } else if(key === km.UP) {
      scrollElementTo(currentSlide, -50, currentSlide.scrollTop - 200);
      return;
    } else if(key === km.PAGE_UP) {
      scrollElementTo(currentSlide, -100, currentSlide.scrollTop - 800);
      return;
    }
  }

  if(key === km.SPACE || key === km.RIGHT || key === km.N) {
    clearTimeout(keyDownTimer);
    keyDownTimer = setTimeout(showNextSlide, 50);
  } else if(key === km.LEFT || key === km.P) {
    clearTimeout(keyDownTimer);
    keyDownTimer = setTimeout(showPreviousSlide, 50);
  }
}

// this === window
this.addEventListener('keydown', onKeyDown, false);

function initSlideShow(event) {
  document.removeEventListener('DOMContentLoaded', initSlideShow);
  loadEntryStyles();
  appendSlides(maybeShowNoUnreadArticlesSlide, true);
}

document.addEventListener('DOMContentLoaded', initSlideShow);

} // END ANONYMOUS NAMESPACE
