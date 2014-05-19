// TODO: refactor into IEAF

var app = app || chrome.extension.getBackgroundPage();

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

// Default timeout(ms) for subscribing
// Used by startSubscription
var SUBSCRIBE_TIMEOUT = 5000;


// Note this is also called in discover code
function startSubscription(url) {

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
      if(subscribed) {
        hideSubscriptionMonitor(function() {
          showErrorMessage('You are already subscribed to "' + url + '".');  
        });
      } else {
        updateSubscriptionMonitor('Downloading "'+url+'"...');
        app.updateFeed(db, {'url': url},
          onSubscribeComplete, SUBSCRIBE_TIMEOUT);
      }
    });
  });
}


function onSubscribeComplete(feed, entriesProcessed, entriesAdded) {
  if(feed.error) {
    hideSubscriptionMonitor(function() {
      var errorMessage = feed.error || 'An unknown error occurred.';
      showErrorMessage('Unable to subscribe to "'+ feed.url+'". ' + 
        errorMessage);
    });
    return;
  }

  updateSubscriptionMonitor('Successfully subscribed! Added '+
    entriesAdded + ' articles.');

  hideSubscriptionMonitor();

  app.updateBadge();

  app.showNotification('Subscribed to ' + feed.title + '. Found ' + entriesAdded + ' new articles.');

  // TODO: there is some bug in the code below that doesnt work
  // after subscribing

/*
Uncaught TypeError: Cannot read property 'add' of undefined
entryUpdated feed-updater.js:60
onEntryUpdateSuccess
*/

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Navigate back to the view feeds list
  showSection('mi-view-subscriptions');

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Add the feed to the feed list
  appendFeed(feed);

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