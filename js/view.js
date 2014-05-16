// view.html script

var app = chrome.extension.getBackgroundPage();
var ONLOAD_DISPLAY_COUNT = 10;
var MAX_APPEND_COUNT = 10;
var READ_SCAN_DELAY = 200;
var APPEND_DELAY = 100;
var NEXT_KEYS = {'32':32, '39':39, '78':78};
var PREV_KEYS = {'37':37, '80':80};

function addPrefetchLink(url) {
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  var head = document.documentElement.firstChild;
  head.appendChild(link);
}

// Look for entries to mark as read
function scanForRead() {
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

  params.limit = limit || MAX_APPEND_COUNT;
  params.offset = 
    document.getElementById('entries').querySelectorAll('div:not([read])').length;

  app.model.connect(function(db) {
    app.model.forEachEntry(db, params, function(entry) {
      renderEntry(entry);
    }, onComplete);
  });
};


function renderEntry(entry) {
  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = app.formatDate(new Date(entry.pubdate));
  }

  var entryLink = app.escapeHTMLHREF(entry.link);

  var headerFontFamilyClass = FONT_FAMILIES[localStorage.HEADER_FONT_FAMILY] || '';
  var bodyFontFamilyClass = FONT_FAMILIES[localStorage.BODY_FONT_FAMILY] || '';

  var template = ['<a href="',entryLink,
    '" class="entryTitle ',headerFontFamilyClass,'" target="_blank" title="',
    app.escapeHTMLAttribute(entryTitle),
    '">',app.truncate(app.escapeHTML(entryTitle),100),
    '</a><span class="entrycontent ',bodyFontFamilyClass,'">', entryContent,'</span>',
    '<span class="entrysource">',
    '<a class="entrysourcelink" url="',entryLink,'" title="',app.escapeHTMLAttribute(entryTitle),'">Bookmark</a> - ',
    '<span title="',
    app.escapeHTMLAttribute(feedTitle),'">',
    '<img src="',app.getFavIcon(entry.baseURI),'" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    app.escapeHTML(app.truncate(feedTitle, 40)),'</span>',
    (entryAuthor ? ' by ' + app.escapeHTML(app.truncate(entry.author,40)):''),
    ' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  
  var bookmark = elem.querySelector('a[url]');
  bookmark.addEventListener('click', addBookmarkClick);
  
  
  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);
}

function addBookmarkClick(event) {
  
  if(!chrome || !chrome.bookmarks) {
    app.console.log('chrome.bookmarks is undefined');
    return;
  }
  
  var url = event.target.getAttribute('url');
  var title = event.target.getAttribute('title');
  if(!url) return;
  if(title) title = title.trim();
  title = title || url;
  
  chrome.bookmarks.create({
      'title': title,
      'url': url
    }, function(){
    app.console.log('Added bookmark %s', url);  
  });
  return false;
}

function showError(msg) {
  var messageElement = document.getElementById('errorMessage');
  messageElement.innerHTML = msg;
  var container = document.getElementById('errorMessageContainer');
  if(container.style.display != 'block') {
    container.style.opacity = 0.0;
    container.style.display = 'block';
    fade(container,0.1, 0, 50);
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
      app.model.markEntryRead(db, parseInt(node.getAttribute('entry')), function() {
        node.setAttribute('read','');
        app.updateBadge();
      });
    });
  }
}

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
  app.each(entries, function(entry){
    container.removeChild(entry);
  });

  if(container.childNodes.length == 0) {
    container.style.display = 'none';
    showNoEntriesInfo();
  }
}

function handleHeaderFontChanged() {
  console.log('Handling header font change event');
  var newHeaderFont = FONT_FAMILIES[localStorage.HEADER_FONT_FAMILY] || '';
  var container = document.getElementById('entries');
  var titles = container.querySelectorAll('.entryTitle');
  console.log('Found %s titles to update header font class to %s', 
    titles.length, newHeaderFont || 'the browser defaults');

  app.each(titles, function(title){
    // http://stackoverflow.com/questions/195951/change-an-elements-css-class-with-javascript
    title.className = 'entryTitle ' + newHeaderFont;
  });
}

function handleBodyFontChanged() {
  console.log('Handling body font change event');
  var newBodyFont = FONT_FAMILIES[localStorage.BODY_FONT_FAMILY] || '';
  var container = document.getElementById('entries');
  var contents = container.querySelectorAll('.entrycontent');
  console.log('Found %s bodies to update body font class to %s', 
    contents.length, newBodyFont || 'the browser defaults');
  app.each(contents, function(content){
    content.className = 'entrycontent ' + newBodyFont;
  });
}


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message of type %s', request.type);
  
  if(request.type == 'pollCompleted') {
    handlePollCompleted();
  } else if(request.type == 'subscribe') {
    handleSubscribe(request.feed);
  } else if(request.type == 'unsubscribe') {
    handleUnsubscribe(request.feed);
  } else if(request.type == 'headerFontChanged') {
    handleHeaderFontChanged();
  } else if(request.type == 'bodyFontChanged') {
    handleBodyFontChanged();
  }
});

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

  // TODO: we should still continue if scrollListener is undefined
  // in the very first call, otherwise the first scroll down event
  // doesn't trigger the check, when in fact it should
  var deltaY = (scrollListener.pageYOffset || pageYOffset) - pageYOffset;
  scrollListener.pageYOffset = pageYOffset;

  if(deltaY >= 0) {
    // no scroll, or scrolled up
    return;
  }

  // Check for read entries
  clearTimeout(scanForReadTimer);
  scanForReadTimer = setTimeout(scanForRead, READ_SCAN_DELAY);

  // TODO: due to async behavior, we should not be appending
  // until read check completes

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
  document.getElementById('entries').addEventListener('click', entryLinkClicked);
  document.getElementById('dismiss').addEventListener('click', hideErrorMessage);
  app.model.connect(function(db) {
    appendEntries(ONLOAD_DISPLAY_COUNT, function() {
      if(document.getElementById('entries').childNodes.length == 0) {
        document.getElementById('entries').style.display = 'none';
        showNoEntriesInfo();
      }
    });
  });
});
