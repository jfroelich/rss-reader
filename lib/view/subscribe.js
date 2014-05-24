
var app = chrome.runtime.getBackgroundPage();

// TODO: there is a bug here if this gets called BEFORE
// the entries exist in the database
function onSubscribe(event) {

  if(event.type != 'subscribe') {
      return;
  }

  var feedId = event.feed;
  var container = document.getElementById('entries');

  var hasUnreadEntriesInView = 
    app.collections.any(container.childNodes, isEntryUnread);

  if(!container.childElementCount || !hasUnreadEntriesInView) {
    container.style.display = 'block';
    document.getElementById('noentries').style.display = 'none';    
    appendEntries();
  }
}

chrome.runtime.onMessage.addListener(onSubscribe);


function onUnsubscribe(event) {
  if(event.type != 'unsubscribe') {
      return;
  }

  var feedId = event.feed;
  var container = document.getElementById('entries');
  var entries = container.querySelectorAll('div[feed="'+feedId+'"]');
  app.collections.each(entries, function(entry){
    container.removeChild(entry);
  });

  showNoEntriesIfEmpty();
}

chrome.runtime.onMessage.addListener(onUnsubscribe);