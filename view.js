// view.html script

var app = chrome.extension.getBackgroundPage();
var ONLOAD_DISPLAY_COUNT = 10;
var MAX_APPEND_COUNT = 10;
var READ_SCAN_DELAY = 200;
var APPEND_DELAY = 100;
var entryCache = {};

function addPrefetchLink(url) {
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  var head = document.documentElement.firstChild;
  head.appendChild(link);
}

// Look for entries to mark as read
function scanForRead() {
  //console.log('Scanning for read articles');
  var divEntries = document.getElementById('entries');
  var cutoff = document.body.scrollTop + window.innerHeight + 10;
  var readEntries = Array.prototype.filter.call(divEntries.childNodes, function(entryElement) {
    return isEntryUnread(entryElement) &&
      (entryElement.offsetTop + entryElement.offsetHeight <= cutoff);
  });

  var ids = Array.prototype.map.call(readEntries, function(el) {
    return parseInt(el.getAttribute('entry'));
  });

  var onModelUpdate = function() {
    app.updateBadge();
    app.each(readEntries, function(el) {
      el.setAttribute('read','');
    });
  };

  if(ids.length) {
    app.model.connect(function(db) {
      app.model.markRead(db, ids, onModelUpdate);
    });
  }
}

// This is based on the UI, not the store
function isEntryUnread(entry) {
  return !entry.hasAttribute('read');
}

// Append new entries to the bottom of the entry list
function appendEntries(limit, onComplete) {

  var params = {};
  params.minimumId = getLastId() || 0;
  params.limit = limit || MAX_APPEND_COUNT;

  app.model.connect(function(db) {
    app.model.forEachEntry(db, params, function(entry) {
      if(!entryCache.hasOwnProperty(entry.id)) {
        // console.log('Loading entry %s', entry.id);
        renderEntry(entry);
      } else {
        console.log('Entry %s already loaded (paging error)', entry.id);
      }
    }, onComplete);
  });
};

// Get the fetch date of the bottom-most entry loaded into the UI
function getLastId() {
  var divEntries = document.getElementById('entries');
  var lastEntry = divEntries.lastChild;
  if(lastEntry) {
    var str = lastEntry.getAttribute('entry');
    if(str) {
      return parseInt(str);
    }
  }
}

function renderEntry(entry) {
  // Paging hack - add it as a property, not an index
  entryCache[''+entry.id] = true;

  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;

  var favIconURL = app.getFavIcon(entry.baseURI);
  favIconURL = favIconURL || 'img/rss_icon_trans.gif';

  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = app.formatDate(new Date(entry.pubdate));
  }
  
  var entryLink = app.escapeHTMLHREF(entry.link);

  var template = ['<a href="',entryLink,
    '" class="entryTitle" target="_blank" title="',
    app.escapeHTMLAttribute(entryTitle),
    '">',app.truncate(app.escapeHTML(entryTitle),100),
    '</a><span class="entrycontent">', entryContent,'</span>',
    '<span class="entrysource">from <span class="entrysourcelink" title="',
    app.escapeHTMLAttribute(feedTitle),'">',
    '<img src="',favIconURL,'" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    app.escapeHTML(app.truncate(feedTitle, 40)),'</span>',
    (entryAuthor ? ' by ' + app.escapeHTML(app.truncate(entry.author,40)):''),
    ' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  
  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);

  // Experimental
  //if(entryLink) {
  //  addPrefetchLink(entryLink);
  //}
}

function showError(msg) {
  var messageElement = document.getElementById('errorMessage');
  messageElement.innerHTML = msg;
  
  var container = document.getElementById('errorMessageContainer');
  if(container.style.display != 'block') {
    container.style.opacity = 0.0;
    container.style.display = 'block';
    app.fade(container,0.1, 50);
  }
}

function hideErrorMessage(event) {
  document.getElementById('errorMessageContainer').style.display = 'none';
}

function showNoEntriesInfo() {
  var lastPolled = document.getElementById('lastpolled');
  var lastPollDateMs = parseInt(localStorage.LAST_POLL_DATE_MS);
  if(isFinite(lastPollDateMs)) {
    lastPolled.innerText = (new Date(lastPollDateMs)).toString();
  } else {
    lastPolled.innerText = 'Unknown';
  }

  document.getElementById('noentries').style.display = 'block';
}

// Click handler for entries container
function entryLinkClicked(event) {  
  var node = event.target;
  if(!node.href)
    return;
  while((node = node.parentNode) && !node.hasAttribute('entry'));
  if(node && !node.hasAttribute('read')) {
    app.model.connect(function(db) {
      app.model.markEntryRead(db, node.getAttribute('entry'), function() {
        node.setAttribute('read','');
        app.updateBadge();
      });
    });
  }
}

// Event handler for pollCompleted message from background page
function handlePollCompleted() {
  var container = document.getElementById('entries');
  if(container.childNodes.length == 0 || !app.any(container.childNodes, isEntryUnread)) {
    container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';
    appendEntries();
  }
}

// TODO: there is a bug here if this gets called BEFORE
// the entries exist in the database
function handleSubscribe(feedId) {
  console.log('Handling subscription event, feed id %s', feedId);
  var container = document.getElementById('entries');
  if(container.childNodes.length == 0 || !app.any(container.childNodes, isEntryUnread)) {
    container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';
    appendEntries();
  }
}

function handleUnsubscribe(feedId) {
  var container = document.getElementById('entries');
  var entries = container.querySelectorAll('div[feed="'+feedId+'"]');
  if(entries) {
    app.each(entries, function(entry){
      container.removeChild(entry);
    });

    if(container.childNodes.length == 0) {
      container.style.display = 'none';
      showNoEntriesInfo();
    } 
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(request.type == 'pollCompleted') {
    handlePollCompleted();
  } else if(request.type == 'subscribe') {
    handleSubscribe(request.feed);
  } else if(request.type == 'unsubscribe') {
    handleUnsubscribe(request.feed);
  }
});

// Keyboard shortcut keycodes for moving to next or previous
var NEXT_KEYS = {'32':32, '39':39, '78':78};
var PREV_KEYS = {'37':37, '80':80};

window.addEventListener('keydown', function(event) {
  if(event.target != document.body) {
    return;
  }

  var divEntries = document.getElementById('entries');
  var entries = divEntries.childNodes;

  if(NEXT_KEYS.hasOwnProperty(event.keyCode)) {
    event.preventDefault();
    app.until(entries, function(e) {
      if(e.offsetTop + e.offsetHeight - document.body.scrollTop > 40) {
        window.scrollTo(0, e.nextSibling ? e.nextSibling.offsetTop : e.offsetTop + e.offsetHeight);
        return false;
      }
      return true;
    });
  } else if(PREV_KEYS.hasOwnProperty(event.keyCode)) {
    app.until(entries, function(e) {
      if(e.offsetTop >= document.body.scrollTop) {
        // Found a previous entry
        if(e.previousSibling) {
          window.scrollTo(0, e.previousSibling.offsetTop);
        } else if(document.body.scrollTop !== 0) {
          window.scrollTo(0, e.offsetTop);
        } else {
          console.log('Unclear case for prev key navigation? Maybe already at top?');
          // TODO: I think it means we are already at the top?
        }
        return false;
      } else if(!e.nextSibling) {

        // Nothing to scroll to, go to the top of the page
        // TODO: maybe don't call it if we are already at the top? or maybe
        // scroll to is smart enough to do nothing in this case
        window.scrollTo(0, e.offsetTop);
        return false;
      }
      return true;
    });
  }
});

var scanForReadTimer;
document.addEventListener('scroll', function scrollListener(event) {

  var deltaY = (scrollListener.pageYOffset || pageYOffset) - pageYOffset;
  scrollListener.pageYOffset = pageYOffset;

  if(deltaY >= 0) {
    // no scroll, or scrolled up
    return;
  }

  // Check for read entries
  clearTimeout(scanForReadTimer);
  scanForReadTimer = setTimeout(scanForRead, READ_SCAN_DELAY);

  // Check if we should append new entries
  var divEntries = document.getElementById('entries');
  var appendThreshold = document.body.scrollTop + window.innerHeight + 100;
  if(divEntries.lastChild && divEntries.lastChild.offsetTop < appendThreshold) {
    clearTimeout(scrollListener.appendEntriesTimer);
    scrollListener.appendEntriesTimer = setTimeout(appendEntries, APPEND_DELAY);
  }
});

window.addEventListener('resize', function(event) {
  clearTimeout(scanForReadTimer);
  scanForReadTimer = setTimeout(scanForRead, READ_SCAN_DELAY);
});

document.addEventListener('DOMContentLoaded', function domContentLoadedListener(event) {

  document.removeEventListener('DOMContentLoaded', domContentLoadedListener);

  var entries = document.getElementById('entries');
  entries.addEventListener('click', entryLinkClicked);
  document.getElementById('dismiss').onclick = hideErrorMessage;
  app.model.connect(function(db) {
    appendEntries(ONLOAD_DISPLAY_COUNT, function appendCompleted() {
      if(entries.childNodes.length == 0) {
        showNoEntriesInfo();
      }
    });
  });
});