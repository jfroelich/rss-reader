// TODO: refactor into IEAF

var app = app || chrome.extension.getBackgroundPage();

// Default timeout(ms) for subscribing
// Used by startSubscription
var SUBSCRIBE_TIMEOUT = 5000;

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
    app.discoverFeeds(query,onDiscoverFeedsComplete, onDiscoverFeedsError, 5000);
  }
  
  
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
      if(subscribed) {
        hideSubscriptionMonitor(function() {
          showErrorMessage('You are already subscribed to "' + url + '".');  
        });
        
      } else {
        // Load up content filter rules
        var contentFilterRules = app.getContentFilterRules();

        updateSubscriptionMonitor('Downloading "'+url+'"...');
        app.updateFeed(db, {'url': url},
          onSubscribeComplete, SUBSCRIBE_TIMEOUT, contentFilterRules);
      }
    });
  });
}

function onSubscribeComplete(feed, entriesProcessed, entriesAdded) {
  if(feed.error) {    
    hideSubscriptionMonitor(function() {
      showErrorMessage('Unable to subscribe to "'+ feed.url+'". ' + 
        (feed.error || 'An unknown error occurred.'));
    });
    return;
  }

  updateSubscriptionMonitor('Successfully subscribed! Added '+
    entriesAdded + ' articles.');

  hideSubscriptionMonitor();

  app.updateBadge();

  app.showNotification('Subscribed to ' + feed.title + '. Found ' + entriesAdded + ' new articles.');

  // TODO: Should we not be doing this here? It is supposed to be in a callback
  // from somewhere else?
  // Navigate back to the view feeds list
  // NOTE: the bug was calling this as a string instead of element
  // add undefined because 'string'.classlist.add means classlist undefined because
  // classlist not a property of tring
  showSection(document.getElementById('mi-view-subscriptions'));

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
  document.getElementById('subscription-form').addEventListener('submit', onSubscribeSubmit);
}

document.addEventListener('DOMContentLoaded', initAddSubscriptionSection);


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
  app.each(results, function(result){

    var snippet = result.contentSnippet.replace('<br>','');

    var favIconURL = app.getFavIconURL(result.url);

    listItem = document.createElement('li');
    listItem.innerHTML = [
      '<button value="',result.url,'" title="',app.escapeHTMLAttribute(result.url),
      '">Subscribe</button>','<img src="',favIconURL,'" title="',
      app.escapeHTMLAttribute(result.link),'">',
      '<a href="',result.link,'" title="',app.escapeHTMLAttribute(result.link),
      '" target="_blank">',result.title,'</a> ',app.truncate(snippet,400),
      '<span class="discover-search-result-url">',app.escapeHTML(result.url),'</span>'

    ].join('');

    var button = listItem.querySelector('button');
    button.addEventListener('click',discoverSubscribeClick);

    resultsList.appendChild(listItem);
  });
}

function onDiscoverFeedsError(errorMessage) {
  // Stop showing progress
  document.getElementById('discover-in-progress').style.display='none';
  console.log('Search error: %s', errorMessage);
  // Inform the user
  showErrorMessage('An error occurred when searching for feeds. Details: ' + errorMessage);
}