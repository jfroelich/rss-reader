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
    // TODO: Onchange => OnChange
    applyEntryStylesOnchange();
  } else if('pollCompleted' == message.type) {
    // Append more articles that ere created as a result of the
    // poll if there are no slides or all the slides are read
    if(!countUnreadSlides()) {
      // TODO: we do not actually need a count here, just a check
      // of whether firstElementChild is defined.
      // TODO: we can use querySelector to get the first slide
      // itself instead of getting the parent container and
      // checking its children.
      // TODO: if the 'all read' slide is implemented, this condition
      // would be inaccurate.
      var isFirst = !$('#slideshow-container').childElementCount;
      appendSlides(hideNoUnreadArticlesSlide,isFirst);
    }
  } else if('subscribe' == message.type) {
    // Append more articles for the new subscription if
    // there are no slides or all the slides are read
    // NOTE: this actually just appends any new articles
    // not just those from the new subscription
    if(!countUnreadSlides()) {
      // TODO: see notes above in poll completed
      var isFirst = !$('#slideshow-container').childElementCount;
      appendSlides(hideNoUnreadArticlesSlide,isFirst);
    }
  } else if('unsubscribe' == message.type) {

    // TODO: rather than this separate variable and
    // a check per iteration, use
    // a function like 'any' that returns whether
    // any slide was removed in aggregate

    var removedCurrentSlide = false;

    //TODO: what attribute is being used by this query?
    var slidesForFeed = $$('div["'+ message.feed +'"]');

    each(slidesForFeed, function(slide) {
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

function markSlideRead(slideElement) {

  if(!slideElement || slideElement.hasAttribute('read')) {
    return;
  }

  var entryId = parseInt(slideElement.getAttribute('entry'));

  // TODO: using openCursor and then cursor.update
  // might be better than using get then put? because the cursor
  // is at the position? the perf diff is probably not
  // great since we get by integer id, but it feels like
  // a better practice. also, we would not need to keep track
  // of store so onsuccess function can be outside

  var entryStore;

  openDB(function(db) {
    var tx = db.transaction('entry','readwrite');
    entryStore = tx.objectStore('entry');
    entryStore.get(entryId).onsuccess = onGetEntry;
  });

  function onGetEntry() {
    var entry = this.result;
    if(entry) {
      delete entry.unread;
      entry.readDate = Date.now();
      chrome.runtime.sendMessage({type:'entryRead',entry:entry});
      entryStore.put(entry);

      updateBadge();
    }

    slideElement.setAttribute('read','');
  }
}

function appendSlides(oncomplete, isFirst) {
  var counter = 0;
  var limit = 3;
  var offset = countUnreadSlides();
  var notAdvanced = true;

  openDB(function(db) {
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
          currentSlide = $('#slideshow-container').firstChild;
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
  var baseURI = URI.parse(entry.link);
  if(baseURI) {
    each(doc.body.getElementsByTagName('img'), function(img) {
      var source = img.getAttribute('src');
      if(!source) return;
      var relativeImageSourceURI = URI.parse(source);
      if(relativeImageSourceURI.scheme) return;
      img.setAttribute('src', URI.resolve(baseURI, relativeImageSourceURI));
    });
  }

  trimDocument(doc);

  var results = calamine.transform(doc, {
    FILTER_ATTRIBUTES: 1,
    UNWRAP_UNWRAPPABLES: 1
  });

  // No need to adopt I guess
  each(results.childNodes, function(n) {
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
  $('#slideshow-container').appendChild(slide);
}

function showNextSlide() {
  if(countUnreadSlides() < 2) {
    appendSlides(function() {
        var c = $('#slideshow-container');
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
  // TODO: should $$ the slides
  var slideNodes = $('#slideshow-container').childNodes;
  return filter(slideNodes, isEntryElementUnread).length;
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
};

slideshow.onMouseWheel = function(event) {
  clearTimeout(slideshow.mouseWheelTimer);
  slideshow.mouseWheelTimer = setTimeout(function() {
    if(event.ctrlKey || slideshow.didWheelScrollY(event)) return;
    if(event.deltaY > 0) {
      slideshow.showNextSlide();
    } else if(event.deltaY < 0) {
      slideshow.showPreviousSlide();
    }
  }, 300);
};

// TODO: instead of binding this to window, I should bind
// it to each slide, and then attach/detach as needed. Same
// with scroll. This way we don't have to do hacks.

slideshow.onKeyDown = function(event) {
  //event.target is body
  //event.currentTarget is window

  var key = key;

  if(event.keyCode == key.DOWN) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop += 200;
      smoothScrollToY(slideshow.currentSlide, 50, slideshow.currentSlide.scrollTop + 200)
      return;
    }
  } else if(event.keyCode == key.PAGE_DOWN) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop += 600;
      smoothScrollToY(slideshow.currentSlide, 100, slideshow.currentSlide.scrollTop + 800);
      return;
    }
  } else if(event.keyCode == key.UP) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop -= 200;
      smoothScrollToY(slideshow.currentSlide, -50, slideshow.currentSlide.scrollTop - 200);
      return;
    }
  } else if(event.keyCode == key.PAGE_UP) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop -= 600;
      smoothScrollToY(slideshow.currentSlide, -100, slideshow.currentSlide.scrollTop - 800);
      return;
    }
  }

  if(event.keyCode == key.SPACE) {
    event.preventDefault();
  }


  if(event.keyCode == key.SPACE || event.keyCode == key.RIGHT || event.keyCode == key.N) {
    clearTimeout(slideshow.keyDownTimer);
    slideshow.keyDownTimer = setTimeout(slideshow.showNextSlide, 50);
  } else if(event.keyCode == key.LEFT || event.keyCode == key.P) {
    clearTimeout(slideshow.keyDownTimer);
    slideshow.keyDownTimer = setTimeout(slideshow.showPreviousSlide, 50);
  }
};

// TODO: bind init to slideshow so I can use 'this'
slideshow.init = function(event) {
  document.removeEventListener('DOMContentLoaded', slideshow.init);
  stylize.applyEntryStylesOnload();
  slideshow.appendSlides(slideshow.maybeShowNoUnreadArticlesSlide, true);
};


// TODO: pay more attention to the 3rd argument to addEventListener. I belive
// this is the useCapture flag. See https://developers.google.com/closure/library/docs/events_tutorial
// for a basic explanation. See also
// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget.addEventListener.
// I believe if we capture from top down we can intercept events that are being forwarded to
// embedded objects and we can prevent events of interest from propagating to those
// embedded objects.

// Simultaneously, we might be able to solve the UP/DOWN issues.

window.addEventListener('keydown', slideshow.onKeyDown, true);



// Turns out this is incredibly annoying because it is too sensitive
// and does not wait until I repeatedly try to extend beyond the top
// or bottom. It runs immediately upon reaching top or bottom. It needs
// to be refactored. For now just disabling.
//window.addEventListener('mousewheel', slideshow.onMouseWheel);

document.addEventListener('DOMContentLoaded', slideshow.init);
chrome.runtime.onMessage.addListener(slideshow.onMessage);