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

const SlideShow = Object.create(null);

SlideShow.currentSlide = null;

SlideShow.moveChildNodes = function(sourceElement, destinationElement) {
  // Copy the source element's nodes into a document fragment before moving
  // them. This yields an incredible performance improvement because all of
  // the appending takes place in a single append of the fragment into the
  // destination.

  const sourceDocument = sourceElement.ownerDocument;

  // Create the fragment using the source document. This way the appends
  // into the fragment are not doing anything funky like eager evaluation of
  // scripts. Although I am not sure if this matters because append's behavior
  // may change in the context of a fragment.
  const fragment = sourceDocument.createDocumentFragment();

  // Next, move the source element's child nodes into the fragment. We are
  // still in an inert context so we are not yet touching the live dom. This
  // repeatedly accesses parentNode.firstChild instead of childNode.nextSibling
  // because each append removes the childNode and shifts firstChild to
  // nextSibling for us.
  // TODO: if we parse into a frag before sanitize and accept the frag as
  // input, i could skip this step? Would it be better to skip?
  // In fact, wouldn't it make sense to always use a document fragment instead
  // of a full document? frags are lightweight document containers after all.
  // but then i still have to think about how to move over just children of
  // the body. i suppose i could just move those into a frag at the start.
  for(let node = sourceElement.firstChild; node;
    node = sourceElement.firstChild) {
    fragment.appendChild(node);
  }

  // Append everything to the live document all at once. This is when
  // all the script evaluation and computed styling and repaints occur.
  // There is no need to use 'adoptNode' or 'importNode'. The transfer
  // of a node between document contexts is done implicitly by appendChild.
  // This is where XSS happens. This is where Chrome eagerly prefetches images.
  // And as a result of that, this is also where pre-fetch errors occur. For
  // example, Chrome reports an error if a srcset attribute value has invalid
  // syntax.
  destinationElement.appendChild(fragment);
};

SlideShow.onMessage = function(message) {
  switch(message.type) {
    case 'pollCompleted':
      SlideShow.maybeAppendSlides();
      break;
    case 'subscribe':
      SlideShow.maybeAppendSlides();
      break;

    // NOTE: I believe this was deprecated
    //case 'unsubscribe':
    //  SlideShow.onUnsubscribe();
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

chrome.runtime.onMessage.addListener(SlideShow.onMessage);

SlideShow.onUnsubscribe = function(message) {
  const slidesForFeed = document.querySelectorAll(
    'div[feed="'+ message.feed +'"]');
  const removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function removeAndCheck(removedCurrent, slide) {
    // TODO: verify removing all listeners
    SlideShow.removeSlide(slide);
    return removedCurrent || (slide === SlideShow.currentSlide);
  }, false);

  if(removedCurrentSlide) {
    // TODO: implement
    console.warn('Removed current slide as a result of unsubscribing but did'+
      ' not update UI');
  }

  SlideShow.maybeShowAllReadSlide();
};

SlideShow.removeSlide = function(slideElement) {
  slideElement.removeEventListener('click', SlideShow.onSlideClick);
  slideElement.remove();
};

SlideShow.markAsRead = function(slide) {
  if(slide.hasAttribute('read')) {
    return;
  }

  slide.setAttribute('read', '');
  const entryIdString = slide.getAttribute('entry');
  const entryId = parseInt(entryIdString, 10);

  db.open(onOpen);

  function onOpen(event) {
    if(event.type !== 'success') {
      // TODO: react to database error?
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const request = store.openCursor(entryId);
    request.onsuccess = onOpenCursor;
  }

  function onOpenCursor(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      console.debug('Cursor undefined in markAsRead');
      return;
    }

    const entry = cursor.value;
    if(entry.readState === db.EntryFlags.READ) {
      console.debug('Attempted to remark a read entry as read:', entry.id);
      return;
    }

    entry.readState = db.EntryFlags.READ;
    entry.dateRead = new Date();

    // Trigger an update request. Do not wait for it to complete.
    const updateRequest = cursor.update(entry);

    // NOTE: while this occurs concurrently with the update request,
    // it involves a separate read transaction that is implicitly blocked by
    // the current readwrite request, so it still occurs afterward.
    const connection = request.transaction.db;
    utils.updateBadgeUnreadCount(connection);

    // Notify listeners that an entry was read.
    // NOTE: this happens async. The entry may not yet be updated.
    // TODO: maybe I should just use a callback instead of a message?
    const entryReadMessage = {
      'type': 'entryRead',
      'entryId': entry.id
    };
    chrome.runtime.sendMessage(entryReadMessage);
  }
};

SlideShow.maybeAppendSlides = function() {
  const unreadCount = SlideShow.countUnreadSlides();

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
  SlideShow.appendSlides(SlideShow.hideAllUnreadSlides, isFirst);
};

SlideShow.appendSlides = function(oncomplete, isFirst) {
  let counter = 0;
  const limit = 5;
  const offset = SlideShow.countUnreadSlides();
  let notAdvanced = true;
  db.open(onOpen);

  // Load all articles that are unread and unarchived
  function onOpen(event) {
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
    const range = IDBKeyRange.only([db.EntryFlags.UNARCHIVED,
      db.EntryFlags.UNREAD]);
    const request = index.openCursor(range);
    request.onsuccess = requestOnSuccess;
  }

  function requestOnSuccess(event) {
    const cursor = event.target.result;

    if(!cursor) {
      return;
    }

    if(notAdvanced && offset) {
      notAdvanced = false;
      cursor.advance(offset);
      return;
    }

    SlideShow.appendSlide(cursor.value, isFirst);

    if(isFirst && counter === 0) {
      // TODO: could just directly query for the slide
      // using querySelector, which would match first slide
      // in doc order.
      SlideShow.currentSlide = document.getElementById(
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
SlideShow.onSlideClick = function(event) {
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
    //  SlideShow.onSlideClick);
    SlideShow.markAsRead(event.currentTarget);
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
SlideShow.appendSlide = function(entry, isFirst) {
  const slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', SlideShow.onSlideClick);

  slide.style.position='absolute';
  slide.style.left = isFirst ? '0%' : '100%';
  slide.style.right = isFirst ? '0%' : '-100%';
  slide.style.overflowX = 'hidden';
  slide.style.top = 0;
  slide.style.bottom = 0;
  slide.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  // The entry was loaded directly from the database, so urls are strings.
  // Grab the most recent link, that is the most current, after redirects
  // and rewrites
  const entryLinkURLString = entry.urls[entry.urls.length - 1];

  const title = document.createElement('a');
  title.setAttribute('href', entryLinkURLString);

  title.setAttribute('class', 'entry-title');
  title.setAttribute('target','_blank');
  title.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    // TODO: also strip control characters?
    // TODO: did I do this sanitization earlier, like when storing? if so
    // then i don't need to be stripping tags or removing control chars
    // here.
    let titleText = replaceHTML(entry.title || '', '');
    titleText = filterArticleTitle(titleText);
    titleText = utils.string.truncate(titleText, 300);
    title.textContent = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  // TODO: use section instead of span
  const content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  const parser = new DOMParser();
  // TODO: try catch?
  const entryContentDocument = parser.parseFromString(entry.content,
    'text/html');

  Calamine.removeBoilerplate(entryContentDocument);
  DOMAid.cleanDocument(entryContentDocument);
  const entryContentBody = entryContentDocument.body ||
    entryContentDocument.documentElement;
  SlideShow.moveChildNodes(entryContentBody, content);

  slide.appendChild(content);

  const source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  // The entry was loaded from the database, in which case entry.feedLink is
  // a URL string.
  const favIcon = document.createElement('img');
  let iconSourceURL = null;
  if(entry.feedLink) {
    try {
      iconSourceURL = getFavIconURL(new URL(entry.feedLink));
    } catch(exception) {
      console.debug('Error creating url to get fav icon', exception);
    }
  } else {
    iconSourceURL = DEFAULT_FAV_ICON_URL;
  }

  if(iconSourceURL) {
    favIcon.setAttribute('src', iconSourceURL.href);
  }

  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  const feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  const entryPubDate = entry.pubdate ?
    ' on ' + utils.date.format(new Date(entry.pubdate)) : '';
  feedTitle.textContent = (entry.feedTitle || 'Unknown feed') + ' by ' +
    (entry.author || 'Unknown author') + entryPubDate;
  source.appendChild(feedTitle);

  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.appendChild(slide);
};

SlideShow.showNextSlide = function() {

  // In order to move to the next slide, we want to conditionally load
  // additional slides. Look at the number of unread slides and conditionally
  // append new slides before going to the next slide.

  const unreadCount = SlideShow.countUnreadSlides();
  if(unreadCount < 2) {
    const isFirst = false;
    SlideShow.appendSlides(onAppendComplete, isFirst);
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
    while(c.childElementCount > 30 && c.firstChild != SlideShow.currentSlide) {
      SlideShow.removeSlide(c.firstChild);
    }

    showNext();
    SlideShow.maybeShowAllReadSlide();
  }

  // Move the current slide out of view and mark it as read, and move the
  // next slide into view, and then update the global variable that tracks
  // the current slide.
  function showNext() {
    const current = SlideShow.currentSlide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      SlideShow.markAsRead(current);
      SlideShow.currentSlide = current.nextSibling;
    }
  }
};

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
SlideShow.showPreviousSlide = function() {
  const current = SlideShow.currentSlide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    SlideShow.currentSlide = current.previousSibling;
  }
};

// Note this only checks the UI and does not hit the db.
SlideShow.isUnreadEntry = function(entryElement) {
  return !entryElement.hasAttribute('read');
};

SlideShow.countUnreadSlides = function() {
  return document.body.querySelectorAll('div[entry]:not([read])').length;
};

// If no slides are loaded, or all slides are read, then show the default
// slide.
SlideShow.maybeShowAllReadSlide = function() {
  const numUnread = SlideShow.countUnreadSlides();
  if(numUnread) {
    return;
  }

  console.warn('maybeShowAllReadSlide not implemented');
};

SlideShow.hideAllUnreadSlides = function() {
  console.warn('hideAllUnreadSlides not implemented');
};

SlideShow.KEY_CODES = {
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

SlideShow.SCROLL_DELTAS = {
  '40': [50, 200],
  '34': [100, 800],
  '38': [-50, -200],
  '33': [-100, -800]
};

SlideShow.keydownTimer = null;

SlideShow.onKeyDown = function(event) {
  //event.target is body
  //event.currentTarget is window

  // Prevent the default behavior for certain keys
  switch(event.keyCode) {
    case SlideShow.KEY_CODES.SPACE:
    case SlideShow.KEY_CODES.DOWN:
    case SlideShow.KEY_CODES.PAGE_DOWN:
    case SlideShow.KEY_CODES.UP:
    case SlideShow.KEY_CODES.PAGE_UP:
      event.preventDefault();
      break;
    default:
      break;
  }

  // Scroll the contents of the current slide
  if(SlideShow.currentSlide) {
    const delta = SlideShow.SCROLL_DELTAS['' + event.keyCode];
    if(delta) {
      utils.scrollToY(SlideShow.currentSlide, delta[0],
        SlideShow.currentSlide.scrollTop + delta[1]);
      return;
    }
  }

  // TODO: maybe I should always be clearing both keydown timers? I need to
  // test more when spamming left right

  // React to navigational commands
  switch(event.keyCode) {
    case SlideShow.KEY_CODES.SPACE:
    case SlideShow.KEY_CODES.RIGHT:
    case SlideShow.KEY_CODES.N:
      clearTimeout(SlideShow.keydownTimer);
      SlideShow.keydownTimer = setTimeout(SlideShow.showNextSlide, 50);
      break;
    case SlideShow.KEY_CODES.LEFT:
    case SlideShow.KEY_CODES.P:
      clearTimeout(SlideShow.keydownTimer);
      SlideShow.keydownTimer = setTimeout(SlideShow.showPreviousSlide, 50);
      break;
    default:
      break;
  }
};

// TODO: instead of binding this to window, bind to each slide? That way
// we don't have to use a global tracking variable like SlideShow.currentSlide,
// which feels hackish.
window.addEventListener('keydown', SlideShow.onKeyDown, false);

SlideShow.init = function(event) {
  document.removeEventListener('DOMContentLoaded', SlideShow.init);
  DisplaySettings.loadStyles();
  SlideShow.appendSlides(SlideShow.maybeShowAllReadSlide, true);
};

document.addEventListener('DOMContentLoaded', SlideShow.init);
