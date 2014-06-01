
var view = {};
view.onMessage = function(message) {
  if('displaySettingsChanged' == message.type) {
    stylize.applyEntryStylesOnchange(message);
  } else if('pollCompleted' == message.type) {
    if(!util.any($('#entries').childNodes, view.isEntryUnread)) {
      $('#entries').style.display = 'block';
      $('#noentries').style.display = 'none';
      view.appendEntries();
    }
  } else if('subscribe' == message.type) {
    var hasUnreadEntriesInView = 
    util.any($('#entries').childNodes, view.isEntryUnread);
    if(!$('#entries').childElementCount || !hasUnreadEntriesInView) {
      $('#entries').style.display = 'block';
      $('#noentries').style.display = 'none';    
      view.appendEntries();
    }
  } else if('unsubscribe' == message.type) {
    util.each($$('div[feed="'+event.feed+'"]'), function(entry){
      entry.removeEventListener('click', view.onEntryClick);
      entry.parentNode.removeChild(entry);
    });

    view.showNoEntriesIfEmpty();
  } else {
    console.log('Unhandled message type %s', message.type);
  }
};

var ScrollEnd = {
  listeners_: [],
  delay: 200,
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

view.appendEntries = function(limit, onComplete) {
  var unreadEntriesInView = $$('#entries div:not([read])');
  limit = limit || 10;
  var offset = unreadEntriesInView ? unreadEntriesInView.length : 0;
  var counter = 0;
  var unlimited = limit <= 0;
  var advanced = false;
  model.connect(function(db) {
    var tx = db.transaction('entry');
    tx.oncomplete = onComplete;
    tx.objectStore('entry').index('unread').openCursor().onsuccess = function(event) {
      var cursor = event.target.result;
      if(!cursor) return;
      if(offset > 0 && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }

      view.renderEntry(cursor.value);
      if(unlimited || (++counter < limit)) {
        cursor.continue();
      }
    };
  });
};

view.showNoEntriesIfEmpty = function() {
  if($('#entries').childElementCount) return;
  var lastPollDateMs = parseInt(localStorage.LAST_POLL_DATE_MS);
  $('#lastpolled').textContent = isFinite(lastPollDateMs) ? 
    (new Date(lastPollDateMs)).toString() : 'Unknown'
  $('#entries').style.display = 'none';
  $('#noentries').style.display = 'block';
};

view.onScrollEndAppend = function(event) {
  if(event.deltaY > 0) return;
  var lastChild = $('#entries').lastChild;
  var appendThreshold = pageYOffset + innerHeight + 100;
  if(lastChild && lastChild.offsetTop < appendThreshold)
    view.appendEntries();
};

view.appendEntriesPrefetchLink = function(url) {
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  document.documentElement.firstChild.appendChild(link);  
};

view.scanForRead = function() {
  var readEntries = Array.prototype.filter.call($('#entries').childNodes, 
    view.shouldMarkAsRead);
  var ids = Array.prototype.map.call(readEntries, view.getEntryId);
  if(!ids.length) return;
  model.connect(function(db) {
    model.markRead(db, ids, function() {
      util.updateBadge();
      util.each(readEntries, view.markEntryAsRead);
    });
  });
};

view.getEntryId = function(entryElement) {
  return parseInt(entryElement.getAttribute('entry'));
};

view.markEntryAsRead = function(entryElement) {
  entryElement.setAttribute('read','');
};

view.shouldMarkAsRead = function(entryElement) {
  var cutoff = pageYOffset + innerHeight + 10;
  return view.isEntryUnread(entryElement) &&
    (entryElement.offsetTop + entryElement.offsetHeight <= cutoff);
};

view.isEntryUnread = function(entry) {
  return !entry.hasAttribute('read');
};

view.onScrollEndScanForRead = function(event) {
  if(event.deltaY > 0) return;
  clearTimeout(view.timer_);// cancel onresize
  view.scanForRead();
};

view.onEntryClick = function(event) {  
  if(event.target.nodeType != Node.ELEMENT_NODE || 
    event.target.localName != 'a' || 
    event.currentTarget.hasAttribute('read')) {
    return;
  }

  event.currentTarget.removeEventListener('click', view.onEntryClick);
  view.markEntryAsRead(event.currentTarget);
  var entryId = view.getEntryId(event.currentTarget);
  model.connect(function(db) {
    var tx = db.transaction('entry','readwrite');
    tx.oncomplete = function() {
      util.updateBadge();
    };
    var store = tx.objectStore('entry');
    store.get(entryId).onsuccess = function(event) {
      var entry = event.target.result;
      if(entry)
        store.put({id: entry.id,feed: entry.feed,hash: entry.hash,created:entry.created});
    };
  });
};

view.renderEntry = function(entry) {
  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = util.formatDate(new Date(entry.pubdate));
  }

  var entryLink = util.escapeHTMLHREF(entry.link);
  var htmlTitleShort = util.truncate(util.escapeHTML(entryTitle),180);
  var attrTitle = util.escapeHTMLAttribute(entryTitle);
  var favIconURL = util.getFavIconURL(entry.baseURI);
  var htmlFeedTitleShort = util.escapeHTML(util.truncate(feedTitle, 40))
  var entryAuthorShort = entryAuthor?' by '+
    util.escapeHTML(util.truncate(entry.author,40)):'';

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
  elem.addEventListener('click', view.onEntryClick);
  $('#entries').appendChild(elem);
};

view.scrollToNextEntry = function(entry) {
  if(entry.offsetTop + entry.offsetHeight - pageYOffset > 40) {
    window.scrollTo(0, entry.nextSibling ? entry.nextSibling.offsetTop : entry.offsetTop + entry.offsetHeight);
    return false;
  }
  return true;
}

view.scrollToPreviousEntry = function(entry) {
  if(entry.offsetTop >= pageYOffset) {
    if(entry.previousSibling) {
      window.scrollTo(0, entry.previousSibling.offsetTop);
    } else if(pageYOffset !== 0) {
      window.scrollTo(0, entry.offsetTop);
    } else {
      console.log('Maybe already at top?');
    }
    return false;
  } else if(!entry.nextSibling) {
    window.scrollTo(0, entry.offsetTop);
    return false;
  }

  return true;
}

view.NEXT_KEYS = {'32':32, '39':39, '78':78};
view.PREV_KEYS = {'37':37, '80':80};

view.onKeyDown = function(event) {
  if(event.target != document.body) { 
    console.log('not on body');
    return;
  }

  if(view.NEXT_KEYS.hasOwnProperty(event.keyCode)) {
    event.preventDefault();
    util.until($('#entries').childNodes, view.scrollToNextEntry);
  } else if(view.PREV_KEYS.hasOwnProperty(event.keyCode)) {
    util.until($('#entries').childNodes, view.scrollToPreviousEntry);
  }
};

view.onResize = function() {
  clearTimeout(view.timer_);
  view.timer_ = setTimeout(view.scanForRead, 200);
};

view.onDOMContentLoaded = function(event) {
  document.removeEventListener('DOMContentLoaded', view.onDOMContentLoaded);
  //util.updateBadge();
  stylize.applyEntryStylesOnload();
  ScrollEnd.addListener(view.onScrollEndScanForRead);
  ScrollEnd.addListener(view.onScrollEndAppend);
  view.appendEntries(10, view.showNoEntriesIfEmpty);
};

// Bindings
window.addEventListener('scroll', ScrollEnd.onScroll);
window.addEventListener('resize', view.onResize);
window.addEventListener('keydown', view.onKeyDown);
document.addEventListener('DOMContentLoaded', view.onDOMContentLoaded);
chrome.runtime.onMessage.addListener(view.onMessage);