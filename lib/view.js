// TODO: consider using MutationObserver instead

// Eventually fires scroll event on vertical scroll events. deltaY
// is a property of the event that is the change in vertical. 
// Negative deltaY is down, positive is up. deltaY is always 
// undefined on the first event but not thereafter.
var ScrollEnd = {
  listeners_: [],
  delay: 2000,
  addListener: function(listener) {
    this.listeners_.push(listener);
  },
  removeListener: function(listener) {
    var index = this.listeners_.indexOf(listener);
    if(index > -1) this.listeners_.splice(index, 1);
  },
  broadcast_: function(event) {
    ScrollEnd.listeners_.forEach(function(listener) {
      listener(event);
    });
  },
  onScroll: function(event) {
    if(!ScrollEnd.listeners_.length)
      return;

    clearTimeout(ScrollEnd.timer_);
    ScrollEnd.timer_ = setTimeout(function() {
      if(!ScrollEnd.canCalculateDelta_) {
        ScrollEnd.broadcast_(event);
        ScrollEnd.canCalculateDelta_ = 1;
      } else {
        var deltaY = ScrollEnd.pageYOffset_ - window.pageYOffset;
        if(deltaY) {
          event.deltaY = deltaY;
          ScrollEnd.broadcast_(event);
        }
      }

      ScrollEnd.pageYOffset_ = window.pageYOffset;
    }, ScrollEnd.delay);            
  }
};

// Set the desired delay and attach
ScrollEnd.delay = 200;
window.addEventListener('scroll', ScrollEnd.onScroll);




var viewMessageDispatcher = {};
viewMessageDispatcher.onMessage = function(message) {
  if('displaySettingsChanged' == message.type) {
      applyEntryStylesOnchange(message);
  } else {
      
  }
}

chrome.runtime.onMessage.addListener(viewMessageDispatcher.onMessage);




var app = chrome.extension.getBackgroundPage();

// TODO: there is a bug here if this gets called BEFORE
// the entries exist in the database
function onSubscribeMessage(event) {

  if(event.type != 'subscribe') {
      return;
  }

  var container = document.getElementById('entries');

  var hasUnreadEntriesInView = 
    app.collections.any(container.childNodes, reading.isEntryUnread);

  if(!container.childElementCount || !hasUnreadEntriesInView) {
    container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';    
    appending.append();
  }
}

chrome.runtime.onMessage.addListener(onSubscribeMessage);


function onUnsubscribe(event) {
  if(event.type != 'unsubscribe') {
      return;
  }

  var feedId = event.feed;
  var container = document.getElementById('entries');
  var entries = container.querySelectorAll('div[feed="'+feedId+'"]');
  
  // remove reading.onClick
  app.collections.each(entries, function(entry){
    entry.removeEventListener('click', reading.onClick);
    container.removeChild(entry);
  });

  appending.showNoEntriesIfEmpty();
}

chrome.runtime.onMessage.addListener(onUnsubscribe);





function bindStylizeOnLoad(event) {
   document.removeEventListener('DOMContentLoaded', bindStylizeOnLoad);
   applyEntryStylesOnload();
}

document.addEventListener('DOMContentLoaded', bindStylizeOnLoad);



// Appending articles to the view
// TODO: does any code that calls forEachEntry ever re-use the
// database connection? If not, there is no point to having connect 
// outside of forEachEntry
// TODO: append should be calling a function like forEachUnreadEntry

var appending = {};

// Cache div#entries lookup
appending.container;

// Inital number of entries to show on page load
appending.ONLOAD_DISPLAY_COUNT = 10;

appending.model = chrome.extension.getBackgroundPage().model;

// Append new entries to the bottom of the entry list
appending.append = function(limit, onComplete) {
  
  if(!reading) {
    console.log('reading is undefined');
  }
  
  var unreadEntriesInView = 
    appending.container.querySelectorAll('div:not([read])');

  var params = {
    limit: limit || 10,
    offset: unreadEntriesInView ? unreadEntriesInView.length : 0
  };


  appending.model.connect(function(db) {
    appending.model.forEachEntry(db, params, rendering.renderEntry, onComplete);
  });
};

appending.showNoEntriesIfEmpty = function() {

  if(appending.container.childElementCount)
    return;    

  var lastPolled = document.getElementById('lastpolled');
  var lastPollDateMs = parseInt(localStorage.LAST_POLL_DATE_MS);
  if(isFinite(lastPollDateMs)) {
    lastPolled.textContent = (new Date(lastPollDateMs)).toString();
  } else {
    lastPolled.textContent = 'Unknown';
  }
  
  appending.container.style.display = 'none';
  document.getElementById('noentries').style.display = 'block';
};

appending.onScrollEnd = function(event) {
  if(event.deltaY > 0)
    return;
  var lastChild = appending.container.lastChild;
  var appendThreshold = pageYOffset + innerHeight + 100;
  if(lastChild && lastChild.offsetTop < appendThreshold)
    appending.append();
};

// Cached lookup to the collections.any function
appending.any = chrome.extension.getBackgroundPage().collections.any;

// Callback when polling completes
appending.onPollCompleted = function(event) {
  if(event.type != 'pollCompleted')
      return;

  // Append if all read
  if(!appending.any(appending.container.childNodes, reading.isEntryUnread)) {
    appending.container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';
    appending.append();
  }
};

// Inits the appending module
appending.init = function() {
    document.removeEventListener('DOMContentLoaded', appending.init);
    
    // Bind in here to nsure ScrollEnd loaded first
    ScrollEnd.addListener(appending.onScrollEnd);
    
    appending.container = $('#entries');   
    appending.append(appending.ONLOAD_DISPLAY_COUNT, appending.showNoEntriesIfEmpty);
};

// Bindings
chrome.runtime.onMessage.addListener(appending.onPollCompleted);
document.addEventListener('DOMContentLoaded', appending.init);


var prefetch = {};

prefetch.appendLink = function(url) {
  
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  
  var head = document.documentElement.firstChild;
  head.appendChild(link);
};


// TODO: in the scan checking on scroll, we should still continue if 
// lastPageYOffset is undefined in the very first call, otherwise 
// the very first scroll down event (the only time it is undefined) 
// doesn't trigger the check, when in fact it should
// TODO: the call to markRead should go through background page 
// module, not directly to db. there should be some intermediate
// controller layer that handles logic, events.

// TODO: do calls to markRead ever come from something that needs 
// to use db for other calls? if not there is no need to have external
// connect, can do it inside mark read (batch mark read that is)

var reading = {};

reading.app = chrome.extension.getBackgroundPage();
reading.DELAY = 200;

// Look for entries to mark as read
reading.scanForRead = function() {
  var divEntries = document.getElementById('entries');

  var readEntries = Array.prototype.filter.call(divEntries.childNodes, reading.shouldMarkAsRead);
  var ids = Array.prototype.map.call(readEntries, reading.getEntryId);
  if(!ids.length) {
    return;
  }

  reading.app.model.connect(function(db) {
    reading.app.model.markRead(db, ids, function() {
      reading.app.extension.updateBadge();
      reading.app.collections.each(readEntries, reading.markEntryAsRead);
    });
  });
};

reading.getEntryId = function(entryElement) {
  return parseInt(entryElement.getAttribute('entry'));
};

reading.markEntryAsRead = function(entryElement) {
  entryElement.setAttribute('read','');
};

reading.shouldMarkAsRead = function(entryElement) {
  var cutoff = pageYOffset + innerHeight + 10;
  return reading.isEntryUnread(entryElement) &&
    (entryElement.offsetTop + entryElement.offsetHeight <= cutoff);
};

reading.isEntryUnread = function(entry) {
  return !entry.hasAttribute('read');
};

reading.onScrollEnd = function(event) {
  if(event.deltaY > 0) return;
  clearTimeout(reading.timer_);// cancel onresize

  reading.scanForRead();
}

reading.onClick = function(event) {  
  if(!event.target.nodeType == Node.ELEMENT_NODE || 
    !event.target.localName == 'a' || 
    event.currentTarget.hasAttribute('read')) {

    return;
  }

  event.currentTarget.removeEventListener('click', reading.onClick);
  reading.markEntryAsRead(event.currentTarget);

  var entryId = reading.getEntryId(event.currentTarget);

  reading.app.model.connect(function(db) {
    reading.app.model.markEntryRead(db, entryId, function() {
      reading.app.extension.updateBadge();
    });
  });
};

reading.init = function(event) {
  document.removeEventListener('DOMContentLoaded', reading.init);
  
  // Bind in here in case ScrollEnd has not loaded yet.
  ScrollEnd.addListener(reading.onScrollEnd);
}

// TODO: should use resizeend
window.addEventListener('resize', function() {
  clearTimeout(reading.timer_);
  reading.timer_ = setTimeout(reading.scanForRead, reading.DELAY);
});

document.addEventListener('DOMContentLoaded', reading.init);






var rendering = {};

rendering.app = chrome.extension.getBackgroundPage();

rendering.renderEntry = function(entry) {

  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = rendering.app.dates.formatDate(new Date(entry.pubdate));
  }

  var entryLink = rendering.app.strings.escapeHTMLHREF(entry.link);

  var htmlTitleShort = 
    rendering.app.strings.truncate(rendering.app.strings.escapeHTML(entryTitle),180);
  var attrTitle = rendering.app.strings.escapeHTMLAttribute(entryTitle);

  var favIconURL = rendering.app.favIcon.getURL(entry.baseURI);

  var htmlFeedTitleShort = rendering.app.strings.escapeHTML(rendering.app.strings.truncate(feedTitle, 40))

  var entryAuthorShort = (entryAuthor ? ' by ' + 
    rendering.app.strings.escapeHTML(
      rendering.app.strings.truncate(entry.author,40)):'');

  var template = [
    '<a href="',entryLink,'" class="entry-title" target="_blank" title="',attrTitle,'">',
    htmlTitleShort,'</a><span class="entry-content">', entryContent,'</span>',
    '<span class="entrysource">','<span title="', attrTitle,'">',
    '<img src="',favIconURL,'" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    htmlFeedTitleShort,'</span>',entryAuthorShort,' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  elem.addEventListener('click', reading.onClick);


  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);
};


var app = chrome.extension.getBackgroundPage();
// TODO: use clear key names here, I just need to keep the digits
// in the key, but can use anything for value. Using key names 
// in value is clearer.
// TODO: look for constants that represent these
// TODO: use an if statement instead of hasOwnProperty
var NEXT_KEYS = {'32':32, '39':39, '78':78};
var PREV_KEYS = {'37':37, '80':80};
var ELEMENT_ENTRIES;

function scrollToNextEntry(entry) {
  if(entry.offsetTop + entry.offsetHeight - pageYOffset > 40) {
    window.scrollTo(0, entry.nextSibling ? entry.nextSibling.offsetTop : entry.offsetTop + entry.offsetHeight);
    return false;
  }
  
  // Keep looking
  return true;
}

function scrollToPreviousEntry(entry) {

  if(entry.offsetTop >= pageYOffset) {
    // Found a previous entry
    if(entry.previousSibling) {
      window.scrollTo(0, entry.previousSibling.offsetTop);
    } else if(pageYOffset !== 0) {
      window.scrollTo(0, entry.offsetTop);
    } else {
      console.log('Unclear case for prev key navigation? Maybe already at top?');
      // TODO: test this case more
    }
    return false;
  } else if(!entry.nextSibling) {

    // Nothing to scroll to, go to the top of the page
    // TODO: maybe don't call it if we are already at the top? or maybe
    // scroll to is smart enough to do nothing in this case
    window.scrollTo(0, entry.offsetTop);
    return false;
  }
  
  // Keep looking
  return true;
}

function keyDownListener(event) {
  if(event.target != document.body) {
    // Ignore keydowns on other things
    // like text inputs. 
    // TODO: what about embedded iframes? maybe this can
    // intercept those events and fix the click through issue?
    return;
  }

  if(NEXT_KEYS[event.keyCode]) {
    // Prevent the page down effect of spacebar
    event.preventDefault();
    app.collections.until(ELEMENT_ENTRIES.childNodes, scrollToNextEntry);
  } else if(PREV_KEYS[event.keyCode]) {
    app.collections.until(ELEMENT_ENTRIES.childNodes, scrollToPreviousEntry);
  }
}

function init() {
    document.removeEventListener('DOMContentLoaded', init);
    ELEMENT_ENTRIES = document.getElementById('entries');
}

// Bindings
window.addEventListener('keydown', keyDownListener);
document.addEventListener('DOMContentLoaded', init)