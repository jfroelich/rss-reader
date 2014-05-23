var app = chrome.extension.getBackgroundPage();
var ONLOAD_DISPLAY_COUNT = 10;

function addPrefetchLink(url) {
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  var head = document.documentElement.firstChild;
  head.appendChild(link);
}

// Append new entries to the bottom of the entry list
function appendEntries(limit, onComplete) {
  var params = {};

  params.limit = limit || 10;
  params.offset = 
    document.getElementById('entries').querySelectorAll('div:not([read])').length;

  app.model.connect(function(db) {
    app.model.forEachEntry(db, params, renderEntry, onComplete);
  });
};

function renderEntry(entry) {
  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = app.dates.formatDate(new Date(entry.pubdate));
  }

  var entryLink = app.strings.escapeHTMLHREF(entry.link);

  var template = ['<a href="',entryLink,
    '" class="entry-title" target="_blank" title="',
    app.strings.escapeHTMLAttribute(entryTitle),
    '">',app.strings.truncate(app.strings.escapeHTML(entryTitle),100),
    '</a><span class="entry-content">', entryContent,'</span>',
    '<span class="entrysource">',
    '<a class="entrysourcelink" url="',entryLink,'" title="',
    app.strings.escapeHTMLAttribute(entryTitle),'">Bookmark</a> - ',
    '<span title="',
    app.strings.escapeHTMLAttribute(feedTitle),'">',
    '<img src="',app.favIcon.getURL(entry.baseURI),
    '" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    app.strings.escapeHTML(app.strings.truncate(feedTitle, 40)),'</span>',
    (entryAuthor ? ' by ' + app.strings.escapeHTML(app.strings.truncate(entry.author,40)):''),
    ' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  
  var bookmark = elem.querySelector('a[url]');
  bookmark.onclick = addBookmarkClick;

  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);
}

function addBookmarkClick(event) {

  // TODO: remove the click listener?
  
  var url = event.target.getAttribute('url');
  var title = event.target.getAttribute('title');
  if(!url) return;
  if(title) title = title.trim();
  title = title || url;
  
  chrome.bookmarks.create({
      'title': title,
      'url': url
    }, function(){
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
    fx.fade(container,0.1, 0, 50);
  }
}

function hideErrorMessage(event) {
  document.getElementById('errorMessageContainer').style.display = 'none';
}

function showNoEntriesInfo() {
  var lastPolled = document.getElementById('lastpolled');
  var lastPollDateMs = parseInt(localStorage.LAST_POLL_DATE_MS);
  if(isFinite(lastPollDateMs)) {
    lastPolled.textContent = (new Date(lastPollDateMs)).toString();
  } else {
    lastPolled.textContent = 'Unknown';
  }

  document.getElementById('noentries').style.display = 'block';
}


// TODO: there is a bug here if this gets called BEFORE
// the entries exist in the database
function handleSubscribe(feedId) {
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
  app.collections.each(entries, function(entry){
    container.removeChild(entry);
  });

  if(container.childNodes.length == 0) {
    container.style.display = 'none';
    showNoEntriesInfo();
  }
}


chrome.runtime.onMessage.addListener(function(request) {
  if(request.type == 'subscribe') {
    handleSubscribe(request.feed);
  } else if(request.type == 'unsubscribe') {
    handleUnsubscribe(request.feed);
  }
});

document.addEventListener('DOMContentLoaded', function viewLoadedListener(event) {
  document.removeEventListener('DOMContentLoaded', viewLoadedListener);
  document.getElementById('dismiss').onclick = hideErrorMessage;
  app.model.connect(function(db) {
    appendEntries(ONLOAD_DISPLAY_COUNT, function() {
      if(document.getElementById('entries').childNodes.length == 0) {
        document.getElementById('entries').style.display = 'none';
        showNoEntriesInfo();
      }
    });
  });
});