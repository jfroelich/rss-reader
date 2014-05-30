// TODO: in the scan checking on scroll, we should still continue if 
// lastPageYOffset is undefined in the very first call, otherwise 
// the very first scroll down event (the only time it is undefined) 
// doesn't trigger the check, when in fact it should
// TODO: the call to markRead should go through background page 
// module, not directly to db. there should be some intermediate
// controller layer that handles logic, events.

// TODO: do calls to markRead ever come from something that needs 
// to use db for other calls? if not there is no need to have external
// connect, can do it inside mark read (batch mark read that is)

var reading = {};

reading.app = chrome.extension.getBackgroundPage();
reading.DELAY = 200;

// Look for entries to mark as read
reading.scanForRead = function() {
  var divEntries = document.getElementById('entries');

  var readEntries = Array.prototype.filter.call(divEntries.childNodes, reading.shouldMarkAsRead);
  var ids = Array.prototype.map.call(readEntries, reading.getEntryId);
  if(!ids.length) {
    return;
  }

  reading.app.model.connect(function(db) {
    reading.app.model.markRead(db, ids, function() {
      reading.app.extension.updateBadge();
      reading.app.collections.each(readEntries, reading.markEntryAsRead);
    });
  });
};

reading.getEntryId = function(entryElement) {
  return parseInt(entryElement.getAttribute('entry'));
};

reading.markEntryAsRead = function(entryElement) {
  entryElement.setAttribute('read','');
};

reading.shouldMarkAsRead = function(entryElement) {
  var cutoff = pageYOffset + innerHeight + 10;
  return reading.isEntryUnread(entryElement) &&
    (entryElement.offsetTop + entryElement.offsetHeight <= cutoff);
};

reading.isEntryUnread = function(entry) {
  return !entry.hasAttribute('read');
};

reading.onScrollEnd = function(event) {
  if(event.deltaY > 0) return;
  clearTimeout(reading.timer_);// cancel onresize

  reading.scanForRead();
}

reading.onClick = function(event) {  
  if(!event.target.nodeType == Node.ELEMENT_NODE || 
    !event.target.localName == 'a' || 
    event.currentTarget.hasAttribute('read')) {

    return;
  }

  event.currentTarget.removeEventListener('click', reading.onClick);
  reading.markEntryAsRead(event.currentTarget);

  var entryId = reading.getEntryId(event.currentTarget);

  reading.app.model.connect(function(db) {
    reading.app.model.markEntryRead(db, entryId, function() {
      reading.app.extension.updateBadge();
    });
  });
};

reading.init = function(event) {
  document.removeEventListener('DOMContentLoaded', reading.init);
  
  // Bind in here in case ScrollEnd has not loaded yet.
  ScrollEnd.addListener(reading.onScrollEnd);
}

// TODO: should use resizeend
window.addEventListener('resize', function() {
  clearTimeout(reading.timer_);
  reading.timer_ = setTimeout(reading.scanForRead, reading.DELAY);
});

document.addEventListener('DOMContentLoaded', reading.init);