(function(exports) {
'use strict';

var app = app || chrome.extension.getBackgroundPage();
var APPEND_DELAY = 100;
var lastPageYOffset;
var appendEntriesTimer;
var ELEMENT_ENTRIES;

function appendScrollListener(event) {
  // Only handle scroll down events
  var deltaY = (lastPageYOffset || pageYOffset) - pageYOffset;
  lastPageYOffset = pageYOffset;
  if(deltaY >= 0) {
    return;
  }

  if(ELEMENT_ENTRIES.lastChild) {
    var appendThreshold = pageYOffset + window.innerHeight + 100;
    if(ELEMENT_ENTRIES.lastChild.offsetTop < appendThreshold) {
      //console.log('Scheduling append because %s is less than %s',
      //  ELEMENT_ENTRIES.lastChild.offsetTop, appendThreshold);
      clearTimeout(appendEntriesTimer);
      appendEntriesTimer = setTimeout(appendEntries, APPEND_DELAY);
    }
  }
}

function handlePollCompleted(event) {
  if(event.type != 'pollCompleted') {
      return;
  }

  var container = document.getElementById('entries');
  if(container.childNodes.length == 0 || !app.any(container.childNodes, isEntryUnread)) {
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

})(this);