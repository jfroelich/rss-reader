
var app = chrome.extension.getBackgroundPage();
var scanForReadTimer;
var lastPageYOffset;
var READ_SCAN_DELAY = 200;

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
    app.browserAction.updateBadge();
    app.collections.each(readEntries, function(el) {
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

function scheduleScanForRead() {
  clearTimeout(scanForReadTimer);
  scanForReadTimer = setTimeout(scanForRead, READ_SCAN_DELAY);
}

function readScrollListener(event) {
  // Only handle scroll down events
  // TODO: we should still continue if lastPageYOffset is undefined
  // in the very first call, otherwise the first scroll down event
  // doesn't trigger the check, when in fact it should
  var deltaY = (lastPageYOffset || pageYOffset) - pageYOffset;
  lastPageYOffset = pageYOffset;

  if(deltaY >= 0) {
    // no scroll, or scrolled up
    return;
  }

  // Check for read entries
  scheduleScanForRead();
}

function entryLinkClicked(event) {  
  var node = event.target;

  // Only pay attention to links
  // TODO: do something more accurate here than checking href?
  if(!node.href) {
    return;
  }

  // Get the parent entry elemnt
  while((node = node.parentNode) && !node.hasAttribute('entry')) {
    
  }

  // Somehow clicked a link outside of expected container
  if(!node) {
    return;
  }
  
  // Clicked on a link in an entry that was already marked
  if(node.hasAttribute('read')) {
    return;
  }

  // Mark as read
  var entryId = parseInt(node.getAttribute('entry'));

  // TODO: do a call to some function in app context rather 
  // than all this explicit code here
  app.model.connect(function(db) {
    app.model.markEntryRead(db, entryId, function() {
      node.setAttribute('read','');
      app.browserAction.updateBadge();
    });
  });
}

function init() {
  document.removeEventListener('DOMContentLoaded', init);
  document.getElementById('entries').addEventListener('click', entryLinkClicked);
}

// Bindings
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', scheduleScanForRead);
document.addEventListener('scroll', readScrollListener);