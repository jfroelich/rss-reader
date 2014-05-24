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
    appending.container = document.getElementById('entries');   
    appending.append(appending.ONLOAD_DISPLAY_COUNT, appending.showNoEntriesIfEmpty);
};

// Bindings
ScrollEnd.addListener(appending.onScrollEnd);
chrome.runtime.onMessage.addListener(appending.onPollCompleted);
document.addEventListener('DOMContentLoaded', appending.init);