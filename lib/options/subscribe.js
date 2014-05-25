var app = chrome.extension.getBackgroundPage();

// Default timeout(ms) for subscribing
// Used by startSubscription
var SUBSCRIBE_TIMEOUT = 5000;
var SEARCH_TIMEOUT = 5000;

// Respond to subscription form submission
function onSubscribeSubmit(event) {

  // Prevent normal form submission event
  event.preventDefault();

  var elementQuery = document.getElementById('subscribe-discover-query');

  var query = elementQuery.value ? elementQuery.value.trim() : '';

  // Do nothing if trimmed value is empty
  if(!query) {
    return false;
  }

  // Suppress resubmits if query in progress
  if(document.getElementById('discover-in-progress').style.display == 'block') {
    return false;
  }
  
  // TODO:
  // Suppress resubmits if last query was a search and the query did not change
  
  // Suppress resubmits if subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    return false;
  }

  // Our very simple heuristic that determines whether the user has entered 
  // a URL or a search query.
  var isURL = app.URI.isValid(app.URI.parse(query));

  if(isURL) {
    // Clear the search results
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
    
    elementQuery.value = '';
    
    startSubscription(query);
  } else {
    // Immediately clear search results, no results message
    // and show the in progress message
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
    document.getElementById('discover-in-progress').style.display='block';
    
    // Do a search
    app.googleFeeds.search(query,onDiscoverFeedsComplete, 
      onDiscoverFeedsError, SEARCH_TIMEOUT);
  }

  return false;
}

// Note this is also called in discover code
function startSubscription(url) {

  if(!navigator.onLine) {
    errorMessageBox.show('Unable to subscribe while offline.');
    return;
  }

  subscriptionMonitor.show();

  app.model.connect(function(db) {
    subscriptionMonitor.update('Checking for existing subscription...');
    app.model.isSubscribed(db, url, function(subscribed){      
      if(subscribed) {
        subscriptionMonitor.hide(function() {
          errorMessageBox.show('You are already subscribed to "' + url + '".');  
        });
        
      } else {
        // Load up content filter rules
        var contentFilterRules = app.contentFiltering.loadRules();

        subscriptionMonitor.update('Downloading "'+url+'"...');
        app.feedUpdater.updateFeed(
          db, 
          {url: url},
          onSubscribeComplete, 
          SUBSCRIBE_TIMEOUT, 
          contentFilterRules
        );
      }
    });
  });
}

function onSubscribeComplete(feed, entriesProcessed, entriesAdded) {
  if(feed.error) {    
    subscriptionMonitor.hide(function() {
      errorMessageBox.show('Unable to subscribe to "'+ feed.url+'". ' + 
        (feed.error || 'An unknown error occurred.'));
    });
    return;
  }

  subscriptionMonitor.update('Successfully subscribed! Added '+
    entriesAdded + ' articles.');

  subscriptionMonitor.hide();

  app.browserAction.updateBadge();

  app.notifications.show(
    'Subscribed to ' + feed.title + '. Found ' + 
      entriesAdded + ' new articles.');

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Navigate back to the view feeds list
  // NOTE: the bug was calling this as a string instead of element
  // add undefined because 'string'.classlist.add means classlist undefined because
  // classlist not a property of tring
  //showSection(document.getElementById('mi-view-subscriptions')); 

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Add the feed to the feed list
  // Set 2nd param to true to indicate inserted sort
  appendFeed(feed, true);

  // TODO: should we not be doing this here? should this be from some function
  // in the background page that broadcasts instead?
  // Broadcast the subscription event
  chrome.runtime.sendMessage({'type':'subscribe','feed':feed.id});
}

function initAddSubscriptionSection(event) {
  document.removeEventListener('DOMContentLoaded', initAddSubscriptionSection);
  // Initialize the Add subscription section
  document.getElementById('subscription-form').onsubmit = onSubscribeSubmit;
}

function discoverSubscribeClick(event) {
  var button = event.target;
  var url = button.value;
  if(!url) {
    return;
  }

  // TODO: Ignore future clicks if error was displayed?

  // Ignore future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    console.log('subscription in progress, ignoring subscription button click');
    return;
  }

  startSubscription(url);
}

function onDiscoverFeedsComplete(query, results) {
  var resultsList = document.getElementById('discover-results-list');
  var noResultsMessage = document.getElementById('discover-no-results');

  document.getElementById('discover-in-progress').style.display='none';

  if(results.length < 1) {
    resultsList.style.display = 'none';
    noResultsMessage.style.display = 'block';
    return;
  }

  if(resultsList.style.display == 'block') {
    resultsList.innerHTML = '';
  } else {
    noResultsMessage.style.display='none';
    resultsList.style.display = 'block';      
  }

  var listItem = document.createElement('li');
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  // Now display the results
  app.collections.each(results, function(result){

    var snippet = result.contentSnippet.replace('<br>','');

    var favIconURL = app.favIcon.getURL(result.url);

    listItem = document.createElement('li');
    listItem.innerHTML = [
      '<button value="',result.url,'" title="',app.strings.escapeHTMLAttribute(result.url),
      '">Subscribe</button>','<img src="',favIconURL,'" title="',
      app.strings.escapeHTMLAttribute(result.link),'">',
      '<a href="',result.link,'" title="',app.strings.escapeHTMLAttribute(result.link),
      '" target="_blank">',result.title,'</a> ',app.strings.truncate(snippet,400),
      '<span class="discover-search-result-url">',app.strings.escapeHTML(result.url),'</span>'

    ].join('');

    var button = listItem.querySelector('button');
    button.onclick = discoverSubscribeClick;
    resultsList.appendChild(listItem);
  });
}

function onDiscoverFeedsError(errorMessage) {
  document.getElementById('discover-in-progress').style.display='none';
  errorMessageBox.show('An error occurred when searching for feeds. Details: ' + errorMessage);
}

document.addEventListener('DOMContentLoaded', initAddSubscriptionSection);