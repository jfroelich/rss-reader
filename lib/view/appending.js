
// Background page context
var app = chrome.extension.getBackgroundPage();

// Number of ms to wait when scheduling append
var APPEND_DELAY = 100;

// Timer id for scheduling append
var appendEntriesTimer;

// Scroll down tracking
var appendLastPageYOffset = 0;

// Global handle of <div id="entries"> that is used everywhere
var ELEMENT_ENTRIES;

// Inital number of entries to show on page load
var ONLOAD_DISPLAY_COUNT = 10;


// Append new entries to the bottom of the entry list
function appendEntries(limit, onComplete) {
  var unreadEntriesInView = ELEMENT_ENTRIES.querySelectorAll('div:not([read])');
  var params = {
    limit: limit || 10,
    offset: unreadEntriesInView.length
  };

  app.model.connect(function(db) {
    app.model.forEachEntry(db, params, renderEntry, onComplete);
  });
}

function scheduleAppend() {
  clearTimeout(appendEntriesTimer);
  appendEntriesTimer = setTimeout(appendEntries, APPEND_DELAY);
}

function showNoEntriesIfEmpty() {
  // Do not how if there are entries in view
  if(ELEMENT_ENTRIES.childElementCount) {
    return;    
  }

  ELEMENT_ENTRIES.style.display = 'none';

  var lastPolled = document.getElementById('lastpolled');
  var lastPollDateMs = parseInt(localStorage.LAST_POLL_DATE_MS);
  if(isFinite(lastPollDateMs)) {
    lastPolled.textContent = (new Date(lastPollDateMs)).toString();
  } else {
    lastPolled.textContent = 'Unknown';
  }

  document.getElementById('noentries').style.display = 'block';
}

function appendScrollListener(event) {

  // Only handle scroll down events
  var deltaY = (appendLastPageYOffset || pageYOffset) - pageYOffset;
  appendLastPageYOffset = pageYOffset;
  if(deltaY >= 0) {
    return;
  }

  if(ELEMENT_ENTRIES.lastChild) {
    var appendThreshold = pageYOffset + window.innerHeight + 100;

    if(ELEMENT_ENTRIES.lastChild.offsetTop < appendThreshold) {
      scheduleAppend();
    }
  }
}

function handlePollCompleted(event) {
  if(event.type != 'pollCompleted') {
      return;
  }

  var container = document.getElementById('entries');
  if(container.childNodes.length == 0 || 
    !app.collections.any(container.childNodes, isEntryUnread)) {
    
    container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';
    appendEntries();
  }
}

function initAppending() {
    document.removeEventListener('DOMContentLoaded', initAppending);

    ELEMENT_ENTRIES = document.getElementById('entries');
    
    appendEntries(ONLOAD_DISPLAY_COUNT, showNoEntriesIfEmpty);
}

document.addEventListener('scroll', appendScrollListener);
chrome.runtime.onMessage.addListener(handlePollCompleted);
document.addEventListener('DOMContentLoaded', initAppending);