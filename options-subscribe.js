// TODO: refactor into IEAF

var app = app || chrome.extension.getBackgroundPage();

// Default timeout(ms) for subscribing
// Used by startSubscription
var SUBSCRIBE_TIMEOUT = 5000;

// Respond to subscription form submission
function onSubscribeSubmit(event) {

  // Prevent normal form submission event
  event.preventDefault();

  var elementAddURL = document.getElementById('addurl');
  var url = elementAddURL.value ? elementAddURL.value.trim() : null;

  // Ignore empty submissions
  if(!url) {
    return;
  }

  // Ignore future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    console.log('subscription in progress, ignoring subscription button click');
    return;
  }

  // Stop and warn if we did not get a valid url
  if(!app.URI.isValid(app.URI.parse(url))) {
    showErrorMessage('"' + url + '" is not a valid webpage location.');    
    return;
  }

  // Reset
  elementAddURL.value = '';
  startSubscription(url);
  return false;
}


// Note this is also called in discover code
function startSubscription(url) {

  // console.log('startSubscription called with url %s', url);

  // Stop and warn if we are not online
  if(navigator.hasOwnProperty('onLine') && !navigator.onLine) {
    console.log('!navigator.onLine');
    showErrorMessage('Unable to subscribe while offline.');
    return;
  }

  showSubscriptionMonitor();

  app.model.connect(function(db) {
    updateSubscriptionMonitor('Checking for existing subscription...');
    
    app.model.isSubscribed(db, url, function(subscribed){
      
      // console.log('Checked whether subscribed to %s', url);
      
      if(subscribed) {
        console.log('Showing already subscribed error');
        
        hideSubscriptionMonitor(function() {
          showErrorMessage('You are already subscribed to "' + url + '".');  
        });
        
      } else {
        // console.log('Not subscribed to %s, continuing subscription process', url);
        
        updateSubscriptionMonitor('Downloading "'+url+'"...');
        console.log('Calling updateFeed on url %s', url);
        app.updateFeed(db, {'url': url},
          onSubscribeComplete, SUBSCRIBE_TIMEOUT);
      }
    });
  });
}


function onSubscribeComplete(feed, entriesProcessed, entriesAdded) {
  // console.log('onSubscribeComplete - start of function');


  if(feed.error) {
    // console.log('onSubscribeComplete - Subscribe completed with error %s', feed.error);
    
    hideSubscriptionMonitor(function() {
      showErrorMessage('Unable to subscribe to "'+ feed.url+'". ' + 
        (feed.error || 'An unknown error occurred.'));
    });
    return;
  }

  // console.log('onSubscribeComplete - Subscribe completed without an error');

  updateSubscriptionMonitor('Successfully subscribed! Added '+
    entriesAdded + ' articles.');

  hideSubscriptionMonitor();

  // console.log('onSubscribeComplete - Calling update badge');
  app.updateBadge();

  // console.log('onSubscribeComplete - Calling show notification');
  app.showNotification('Subscribed to ' + feed.title + '. Found ' + entriesAdded + ' new articles.');


  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Navigate back to the view feeds list
  // console.log('onSubscribeComplete - Calling showSection');
  // NOTE: the bug was calling this as a string instead of element
  // add undefined because 'string'.classlist.add means classlist undefined because
  // classlist not a property of tring
  showSection(document.getElementById('mi-view-subscriptions'));

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Add the feed to the feed list
  // Set 2nd param to true to indicate inserted sort
  appendFeed(feed, true);

  // TODO: we need to add the feed as an option in the content filters create rule
  createContentFilterSelectFeedAppendOption(
    document.getElementById('create-filter-feed'),
    feed,
    true
  );


  // TODO: should we not be doing this here? should this be from some function
  // in the background page that broadcasts instead?
  // Broadcast the subscription event
  chrome.runtime.sendMessage({'type':'subscribe','feed':feed.id});
}

function initAddSubscriptionSection(event) {
  document.removeEventListener('DOMContentLoaded', initAddSubscriptionSection);
  // Initialize the Add subscription section
  document.getElementById('subscription-form').addEventListener('submit', onSubscribeSubmit);
}

document.addEventListener('DOMContentLoaded', initAddSubscriptionSection);