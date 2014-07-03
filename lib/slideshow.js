'use strict';
/**
 * TODO: review all node removal. Using element.remove() or
 * node.parentNode.removeChild(node) just detaches the node
 * from the DOM. For the node to get eventually GCed, all
 * references to the node must also be removed. This specifically
 * includes event listeners and anywhere the node is referenced
 * in memory.
 */

var currentSlide = null;

function onViewMessage(message) {
  if('displaySettingsChanged' == message.type) {
    applyEntryStylesOnChange();
  } else if('pollCompleted' == message.type) {
    // Append more articles that were created as a result of the
    // poll if there are no slides or all the slides are read
    if(!countUnreadSlides()) {
      // TODO: we do not actually need a count here, just a check
      // of whether firstElementChild is defined.
      // TODO: we can use querySelector to get the first slide
      // itself instead of getting the parent container and
      // checking its children.
      // TODO: if the 'all read' slide is implemented, this condition
      // would be inaccurate.
      var isFirst = !document.getElementById('slideshow-container').firstChild;
      appendSlides(hideNoUnreadArticlesSlide,isFirst);
    }
  } else if('subscribe' == message.type) {
    // Append more articles for the new subscription if
    // there are no slides or all the slides are read
    // NOTE: this actually just appends any new articles
    // not just those from the new subscription
    if(!countUnreadSlides()) {
      // TODO: see notes above in poll completed
      var isFirst = !document.getElementById('slideshow-container').firstChild;
      appendSlides(hideNoUnreadArticlesSlide,isFirst);
    }
  } else if('unsubscribe' == message.type) {

    // TODO: rather than this separate variable and
    // a check per iteration, use
    // a function like 'any' that returns whether
    // any slide was removed in aggregate

    var removedCurrentSlide = false;

    //TODO: what attribute is being used by this query?
    // this needs testing and revision
    var slidesForFeed = document.querySelectorAll('div["'+ message.feed +'"]');

    Array.prototype.forEach.call(slidesForFeed, function(slide) {
      if(slide == currentSlide) {
        removedCurrentSlide = true;
      }

      // TODO: we need to remove all references to the slide
      // NOTE: currentSlide can be one of the references
      // NOTE: other listeners can be references. Are there
      // other listeners?
      slide.removeEventListener('click', onSlideClick);
      slide.remove();
    });

    if(removedCurrentSlide) {
      // TODO: implement
    }

    maybeShowNoUnreadArticlesSlide();
  }
}

chrome.runtime.onMessage.addListener(onViewMessage);


function markSlideRead(slideElement) {

  if(!slideElement) {
    return;
  }


  if(slideElement.hasAttribute('read')) {
    return;
  }

  openIndexedDB(function(db) {
    var entryId = parseInt(slideElement.getAttribute('entry'));
    markEntryAsRead(db, entryId, function() {
      slideElement.setAttribute('read','');
    });
  });
}

function appendSlides(oncomplete, isFirst) {

  // TODO: encapsulate most of this in a forEachEntry
  // function in entry.js

  var counter = 0;
  var limit = 3;
  var offset = countUnreadSlides();
  var notAdvanced = true;

  openIndexedDB(function(db) {
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
  if(event.target.matches('img')) {
    if(!event.target.parentElement.matches('a')) {
      return;
    }
  } else if(!event.target.matches('a')) {
    return;
  }

  if(!event.currentTarget.hasAttribute('read')) {
    event.currentTarget.removeEventListener('click', onSlideClick);
    markSlideRead(event.currentTarget);
  }
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
    var titleText = stripTags(entry.title);
    titleText = truncate(titleText, 200);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);

  var content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = entry.content;

  // Resolve relative images
  // TODO: move this out of here, into a function ro part of calamine or
  // something
  var baseURI = parseURI(entry.link);
  if(baseURI) {
    Array.prototype.forEach.call(doc.body.getElementsByTagName('img'), function(img) {
      var source = img.getAttribute('src');
      if(!source) return;
      var relativeImageSourceURI = parseURI(source);
      if(relativeImageSourceURI.scheme) return;
      img.setAttribute('src', resolveURI(baseURI, relativeImageSourceURI));
    });
  }

  trimDocument(doc);

  var results = calamineTransformDocument(doc, {
    FILTER_ATTRIBUTES: 1,
    UNWRAP_UNWRAPPABLES: 1
  });

  // NOTE: this is the major source of the RSS
  // No need to adopt I guess
  Array.prototype.forEach.call(results.childNodes, function(n) {
    if(n) content.appendChild(n);
  });

  slide.appendChild(content);

  var source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  var favIcon = document.createElement('img');
  favIcon.setAttribute('src', getFavIconURL(entry.feedLink || entry.baseURI));
  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  var feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  var entryPubDate = entry.pubdate ? ' on ' + formatDate(new Date(entry.pubdate)) : '';
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
          c.removeChild(c.firstChild);
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
  // TODO: should just document.querySelectorAll the slides
  // TODO: even better, just select slides with unread attribute
  var slideNodes = document.getElementById('slideshow-container').childNodes;
  return Array.prototype.filter.call(slideNodes, isEntryElementUnread).length;
}

function maybeShowNoUnreadArticlesSlide() {
  if(countUnreadSlides() == 0) {
    console.log('not implemented');
  }
}

function hideNoUnreadArticlesSlide() {
  console.log('not implemented');
}

function didWheelScrollY(event) {
  // event.currentTarget is undefined here, I think because we bind to window
  // and not an element.
  // event.target is not div.entry when the mouse pointer is hovering over
  // any element within the div, so we cheat because we know currentSlide
  // if we bothered to bind mouse wheel to each slide we
  // could use currentTarget and would be 'cheating' less

  if(currentSlide) {
    var t = slideshow.currentSlide;
    if(!t.scrollTop || t.scrollTop + t.offsetHeight >= t.scrollHeight) {
      return false;
    }
    return event.deltaY;
  } else {
    return true;
  }
}


var keyDownTimer;

function onKeyDown(event) {
  //event.target is body
  //event.currentTarget is window

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

  if(currentSlide) {
    if(key == KEY.DOWN) {
      smoothScrollToY(currentSlide, 50, currentSlide.scrollTop + 200)
      return;
    } else if(key == KEY.PAGE_DOWN) {
      smoothScrollToY(currentSlide, 100, currentSlide.scrollTop + 800);
      return;
    } else if(key == KEY.UP) {
      smoothScrollToY(currentSlide, -50, currentSlide.scrollTop - 200);
      return;
    } else if(key == KEY.PAGE_UP) {
      smoothScrollToY(currentSlide, -100, currentSlide.scrollTop - 800);
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

// TODO: pay more attention to the 3rd argument to addEventListener. I belive
// this is the useCapture flag. See
// https://developers.google.com/closure/library/docs/events_tutorial
// See https://developer.mozilla.org/en-US/docs/Web/API/EventTarget.addEventListener.
// I believe if we capture from top down we can intercept events that are being forwarded to
// embedded objects and we can prevent events of interest from propagating to those
// embedded objects.

// TODO: instead of binding this to window, bind to each slide?
window.addEventListener('keydown', onKeyDown);

function initSlideShow(event) {
  document.removeEventListener('DOMContentLoaded', initSlideShow);

  applyEntryStylesOnLoad();

  // We know isFirst is true because this is onload
  appendSlides(maybeShowNoUnreadArticlesSlide, true);
}

document.addEventListener('DOMContentLoaded', initSlideShow);