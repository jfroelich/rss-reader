

// TODO: in the scan checking on scroll, we should still continue if 
// lastPageYOffset is undefined in the very first call, otherwise 
// the very first scroll down event (the only time it is undefined) 
// doesn't trigger the check, when in fact it should


var app = chrome.extension.getBackgroundPage();
var scanForReadTimer;
var readingLastPageYOffset;
var READ_SCAN_DELAY = 200;


function scheduleScanForRead() {
  clearTimeout(scanForReadTimer);
  scanForReadTimer = setTimeout(scanForRead, READ_SCAN_DELAY);
}

// Look for entries to mark as read
function scanForRead() {
  var divEntries = document.getElementById('entries');
  var cutoff = document.body.scrollTop + window.innerHeight + 10;
  
  // Note: when scanning for unread entries, keep in mind that read entries can
  // come after unread because there are other things (like entryClicked) that 
  // can mark the entry as read.
  
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

function readScrollListener(event) {
  // Only handle scroll down events
  var deltaY = (readingLastPageYOffset || pageYOffset) - pageYOffset;
  readingLastPageYOffset = pageYOffset;

  if(deltaY >= 0) {
    // no scroll, or scrolled up
    return;
  }

  // Check for read entries
  scheduleScanForRead();
}

function entryClicked(event) {  

  // event.target is what was clicked, event.currentTarget is the containing
  // entry div where entryClicked is bound.

  // Ignore clicks on things other than links
  if(!event.target.nodeType == Node.ELEMENT_NODE || !event.target.localName == 'a') {
    return;
  }

  // Clicked on a link in an entry that was already marked
  // This should never happen because we remove the listener, and this 
  // only gets called while listening, but an extra check here does 
  // not really affect performance.
  if(event.currentTarget.hasAttribute('read')) {
    console.warn('ignoring click on entry already read, listener was not removed');
    return;
  }

  // Stop listening to future click events for reading purposes
  event.currentTarget.removeEventListener('click', entryClicked);



  // Mark as read in the UI here even if the database call fails later. 
  // The worst case is the user reloads and the article remains unread
  event.currentTarget.setAttribute('read','');

  

  var entryId = parseInt(event.currentTarget.getAttribute('entry'));
  console.log('Marking entry %s as read as a result of a click', entryId);

  // TODO: do a call to some function in app context rather 
  // than all this explicit code here
  app.model.connect(function(db) {
    app.model.markEntryRead(db, entryId, function() {
      app.browserAction.updateBadge();
    });
  });
}

// Bindings
window.addEventListener('resize', scheduleScanForRead);
document.addEventListener('scroll', readScrollListener);