// view.html script

var app = app || chrome.extension.getBackgroundPage();
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

  // console.log('Append entries limit is %s', params.limit);

  app.model.connect(function(db) {
    app.model.forEachEntry(db, params, function(entry) {
      renderEntry(entry);
    }, onComplete);
  });
};


function renderEntry(entry) {
  // console.log('Rendering %s', entry.title);
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
    '<img src="',app.getFavIconURL(entry.baseURI),'" width="16" height="16" style="max-width:19px;margin-right:3px;">',
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


chrome.runtime.onMessage.addListener(function(request) {
  if(request.type == 'subscribe') {
    handleSubscribe(request.feed);
  } else if(request.type == 'unsubscribe') {
    handleUnsubscribe(request.feed);
  } else if(request.type == 'headerFontChanged') {
    handleHeaderFontChanged();
  } else if(request.type == 'bodyFontChanged') {
    handleBodyFontChanged();
  }
});


document.addEventListener('DOMContentLoaded', function viewLoadedListener(event) {

  document.removeEventListener('DOMContentLoaded', viewLoadedListener);
  
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
