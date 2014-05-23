

var app = chrome.extension.getBackgroundPage();
var APPEND_DELAY = 100;

var appendEntriesTimer;
var ELEMENT_ENTRIES;

function scheduleAppend() {
  clearTimeout(appendEntriesTimer);
  appendEntriesTimer = setTimeout(appendEntries, APPEND_DELAY);
}

var appendLastPageYOffset = 0;

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

function init() {
    document.removeEventListener('DOMContentLoaded', init);
    ELEMENT_ENTRIES = document.getElementById('entries');
}

document.addEventListener('scroll', appendScrollListener);
chrome.runtime.onMessage.addListener(handlePollCompleted);
document.addEventListener('DOMContentLoaded', init);