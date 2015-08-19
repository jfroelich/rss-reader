// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var currentSlide = null;

function viewDispatchMessage(message) {

  var VIEW_MESSAGE_HANDLER_MAP = {
    displaySettingsChanged: lucu.style.onChange,
    pollCompleted: maybeAppendMoreSlides,
    subscribe: maybeAppendMoreSlides,
    unsubscribe: viewOnUnsubscribeMessage
  };

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
  appendSlides(hideNoUnreadArticlesSlide, isFirst);
}

function viewOnUnsubscribeMessage(message) {

  var slidesForFeed = document.querySelectorAll('div[feed="'+ message.feed +'"]');
  var removedCurrentSlide = Array.prototype.reduce.call(
    slidesForFeed, function(removedCurrent, slide) {
    // TODO: verify removing all listeners
    removeSlideElement(slide);
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

function markSlideRead(slide) {

  var entryId = parseInt(slide.getAttribute('entry'));

  // Guard against attempts to re-mark. This can happen for many reasons
  if(slide.hasAttribute('read')) {
    return;
  }

  slide.setAttribute('read', '');

  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction('entry', 'readwrite');
    var store = tx.objectStore('entry');
    // TODO: use the implied range syntax instead?
    var range = IDBKeyRange.only(entryId);
    var markReadRequest = store.openCursor(range);
    markReadRequest.onsuccess = function () {
      var cursor = this.result;
      if(!cursor) return;
      var entry = cursor.value;
      if(!entry) return;
      if(!entry.hasOwnProperty('unread')) return;
      delete entry.unread;
      entry.readDate = Date.now();
      cursor.update(entry);

      // Update the badge
      lucu.badge.update();

      chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
    };
  };
}

function appendSlides(oncomplete, isFirst) {

  var counter = 0;
  var limit = 3;
  var offset = countUnreadSlides();
  var notAdvanced = true;

  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction('entry');
    tx.oncomplete = oncomplete;
    tx.objectStore('entry').index('unread').openCursor().onsuccess =
      renderEntry;
  };

  // TODO: consider using async.each with limit

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

  if(event.which != 1) {
    console.debug('onSlideClick event.which != 1. %o', event);
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
    var titleText = lucu.string.stripTags(entry.title);

    titleText = calamine.stripTitlePublisher(titleText);

    titleText = lucu.string.truncate(titleText, 300);

    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  // TODO: use section instead of span

  var content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = entry.content;

  lucu.sanitize.removeComments(doc);
  lucu.sanitize.removeBlacklistedElements(doc);
  lucu.sanitize.removeSourcelessImages(doc);
  lucu.sanitize.removeTracerImages(doc);
  lucu.sanitize.unwrapNoscripts(doc);
  lucu.sanitize.unwrapNoframes(doc);
  // lucu.sanitize.removeInvisibleElements(doc);
  lucu.sanitize.canonicalizeSpaces(doc);
  lucu.trim.trimNodes(doc);
  lucu.sanitize.removeEmptyNodes(doc);
  lucu.sanitize.removeEmptyElements(doc);
  var results = calamine.transform(doc, {
    FILTER_NAMED_AXES: true,
    ANNOTATE: false
  });
  lucu.sanitize.removeJavascriptAnchors(results);
  lucu.sanitize.unwrapDescendants(results);
  lucu.sanitize.removeDescendantAttributes(lucu.sanitize.DEFAULT_ALLOWED_ATTRIBUTES , results);
  lucu.trim.trimElement(results);
  lucu.sanitize.removeEmptyElements(doc);
  lucu.sanitize.transformSingleItemLists(results);

  content.appendChild(results);
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
    ' on ' + lucu.date.format(new Date(entry.pubdate)) : '';
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

function initSlideShow(event) {
  document.removeEventListener('DOMContentLoaded', initSlideShow);
  lucu.style.onLoad();
  appendSlides(maybeShowNoUnreadArticlesSlide, true);
}

document.addEventListener('DOMContentLoaded', initSlideShow);
