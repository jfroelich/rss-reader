
var slideshow = {};
slideshow.currentSlide = null;

slideshow.onMessage = function(message) {
  if('displaySettingsChanged' == message.type) {
    stylize.applyEntryStylesOnchange();
  } else if('pollCompleted' == message.type) {
    if(!slideshow.countUnread()) {
      slideshow.appendSlides(slideshow.hideNoUnreadArticlesSlide, 
        !$('#slideshow-container').childElementCount);
    }
  } else if('subscribe' == message.type) {
    if(!slideshow.countUnread()) {
      slideshow.appendSlides(slideshow.hideNoUnreadArticlesSlide, 
        !$('#slideshow-container').childElementCount);
    }
  } else if('unsubscribe' == message.type) {
    console.log('unsubscribed from %s', message.feed);
    var removedCurrentSlide = false;
    util.each($$('div["'+ message.feed +'"]'), function(slide) {
      if(slide == slideshow.currentSlide) {
        removedCurrentSlide;
      }
      slide.removeEventListener('click', slideshow.onSlideClick);
      slide.parentNode.removeChild(slide);
    });

    // TODO: implement me
    if(removedCurrentSlide) {
      console.log('removed current slide when unsubscribing, not implemented');
    }
    
    slideshow.maybeShowNoUnreadArticlesSlide();
  }
};

slideshow.markSlideRead = function(slideElement) {
  
  if(!slideElement || slideElement.hasAttribute('read')) {
    return;
  }
  
  var entryId = parseInt(slideElement.getAttribute('entry'));

  model.connect(function(db) {
    var tx = db.transaction('entry','readwrite');
    var store = tx.objectStore('entry');
    tx.oncomplete = function(event) {
      slideElement.setAttribute('read','');
      util.updateBadge();
    };
    
    store.get(entryId).onsuccess = function(event) {
      if(this.result) {
        delete this.result.unread;
        this.result.readDate = Date.now();
        chrome.runtime.sendMessage({'type':'entryRead',entry:this.result});
        store.put(this.result);
      }
    };
  });
};

slideshow.appendSlides = function(oncomplete, isFirst) {
  var counter = 0, limit = 3, offset = slideshow.countUnread(), notAdvanced = 1;
  model.connect(function(db) {
    var tx = db.transaction('entry');
    tx.oncomplete = oncomplete;
    tx.objectStore('entry').index('unread').openCursor().onsuccess = renderEntry;
  });

  var renderEntry = function(event) {
    if(!event.target.result) return;
    if(notAdvanced && offset) {
      notAdvanced = 0;
      return event.target.result.advance(offset);
    }
    
    slideshow.appendSlide(event.target.result.value, isFirst);
    if(isFirst && counter == 0) {
      // Setup the slide cursor as pointing to the first slide
      slideshow.currentSlide = $('#slideshow-container').firstChild;
      isFirst = false;
    }

    if(++counter < limit) event.target.result.continue();
  };
};

slideshow.onSlideClick = function(event) {
  if(util.isImage(event.target)) {
    if(!util.isAnchor(event.target.parentNode)) {
      return;      
    }
  } else if(!util.isAnchor(event.target)) {
    return;
  }

  if(!event.currentTarget.hasAttribute('read')) {
    event.currentTarget.removeEventListener('click', slideshow.onSlideClick);
    slideshow.markSlideRead(event.currentTarget);
  }
};

slideshow.appendSlide = function(entry, isFirst) {
  var slide = document.createElement('div');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', this.onSlideClick);

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
    var titleText = util.stripTags(entry.title);
    titleText = util.truncate(titleText, 200);
    title.innerHTML = titleText;
  } else {
    title.textContent = 'Untitled';
  }

  slide.appendChild(title);


  var content = document.createElement('span');
  content.setAttribute('class', 'entry-content');

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = entry.content || '';

  // Snaitizer + calamine is wonky atm.
  //sanitizer.sanitize(entry.link, doc.body);

  var newBody = calamine.transform(doc);

  doc.body.innerHTML = newBody.innerHTML;

  // Resolve relative images
  var baseURI = URI.parse(entry.link);
  if(baseURI) {
    util.each(doc.querySelectorAll('img'), function(img) {
      var source = img.getAttribute('src');
      if(!source) return;
      var relativeImageSourceURI = URI.parse(source);
      if(relativeImageSourceURI.scheme) return;
      img.setAttribute('src', URI.resolve(baseURI, relativeImageSourceURI));
    });    
  }

  trimming.trimDocument(doc);
  content.innerHTML = doc.body.innerHTML;

  slide.appendChild(content);

  var source = document.createElement('span');
  source.setAttribute('class','entrysource');
  slide.appendChild(source);

  var favIcon = document.createElement('img');
  favIcon.setAttribute('src', util.getFavIconURL(entry.feedLink || entry.baseURI));
  favIcon.setAttribute('width', '16');
  favIcon.setAttribute('height', '16');
  source.appendChild(favIcon);

  var feedTitle = document.createElement('span');
  feedTitle.setAttribute('title',entry.feedLink);
  var entryPubDate = entry.pubdate ? ' on ' + util.formatDate(new Date(entry.pubdate)) : '';
  feedTitle.textContent = (entry.feedTitle || 'Unknown feed') + ' by ' + 
    (entry.author || 'Unknown author') + entryPubDate;
  source.appendChild(feedTitle);
  $('#slideshow-container').appendChild(slide);
};

slideshow.showNextSlide = function() {
  var showNext = function() {
    var current = slideshow.currentSlide;
    if(current.nextSibling) {
      current.style.left = '-100%';
      current.style.right = '100%';
      current.nextSibling.style.left = '0px';
      current.nextSibling.style.right = '0px';
      current.scrollTop = 0;

      // NOTE: i also need to mark read initially 
      // if in view and fully in view
      // This marks as read if not already read
      slideshow.markSlideRead(current);
      slideshow.currentSlide = current.nextSibling;

      // Set the new slide as focused so that downarrow works as expected
      // and causes scroll. NOTE: this did not solve the bug.
      // current.focus();
    }  
  };
  
  if(slideshow.countUnread() < 2) {
    slideshow.appendSlides(function() {
        var c = $('#slideshow-container');
        while(c.childElementCount > 30 && c.firstChild != slideshow.currentSlide) {
          c.removeChild(c.firstChild);
        }

        showNext();
        slideshow.maybeShowNoUnreadArticlesSlide();
    }, false);
  } else {
    showNext();
  }
};

slideshow.showPreviousSlide = function() {
  var current = slideshow.currentSlide;
  if(current.previousSibling) {
    current.style.left = '100%';
    current.style.right = '-100%';
    current.previousSibling.style.left = '0px';
    current.previousSibling.style.right = '0px';
    slideshow.currentSlide = current.previousSibling;
  }
}

slideshow.isEntryUnread = function(entryElement) {
  return !entryElement.hasAttribute('read');
};

slideshow.countUnread = function() {
  return util.filter($('#slideshow-container').childNodes, 
    slideshow.isEntryUnread).length;
};

slideshow.maybeShowNoUnreadArticlesSlide = function() {
  if(slideshow.countUnread() == 0) {
    console.log('all read slide not yet implemented');
  }
};

slideshow.hideNoUnreadArticlesSlide = function() {
  console.log('hideNoUnreadArticlesSlide not implemented');
};

slideshow.didWheelScrollY = function(event) {
  // event.currentTarget is undefined here, I think because we bind to window 
  // and not an element.
  // event.target is not div.entry when the mouse pointer is hovering over 
  // any element within the div, so we cheat because we know currentSlide
  // if we bothered to bind mouse wheel to each slide we 
  // could use currentTarget and would be 'cheating' less

  if(slideshow.currentSlide) {
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

  var key = util.key;

  if(event.keyCode == key.DOWN) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop += 200;
      util.smoothScrollToY(slideshow.currentSlide, 50, slideshow.currentSlide.scrollTop + 200)
      return;  
    }    
  } else if(event.keyCode == key.PAGE_DOWN) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop += 600;
      util.smoothScrollToY(slideshow.currentSlide, 100, slideshow.currentSlide.scrollTop + 800);
      return;
    }
  } else if(event.keyCode == key.UP) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop -= 200;
      util.smoothScrollToY(slideshow.currentSlide, -50, slideshow.currentSlide.scrollTop - 200);
      return;
    }
  } else if(event.keyCode == key.PAGE_UP) {
    if(slideshow.currentSlide) {
      event.preventDefault();
      //slideshow.currentSlide.scrollTop -= 600;
      util.smoothScrollToY(slideshow.currentSlide, -100, slideshow.currentSlide.scrollTop - 800);
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