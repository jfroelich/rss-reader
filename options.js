// Options user interface lib

var app = chrome.extension.getBackgroundPage();

var SUBSCRIBE_TIMEOUT = 5000;

var feedTable, noFeedsMessage;

// Respond to subscription form submission
function onSubscribeSubmit(event) {

  // Prevent normal form submission
  event.preventDefault();

  var elementAddURL = document.getElementById('addurl');
  var url = elementAddURL.value;
  url = url ? url.trim() : null;

  if(!url) {
    return;
  }

  if(!app.URI.isValid(app.URI.parse(url))) {
    showErrorMessage('"' + url + '" is not a valid URL.');
    return;
  }

  if(navigator.hasOwnProperty('onLine') && !navigator.onLine) {
    console.log('!navigator.onLine');
    showErrorMessage('Unable to subscribe while offline');
    return;
  }

  elementAddURL.value = '';

  app.model.connect(function(db) {
    app.model.isSubscribed(db, url, function(subscribed){
      if(subscribed) {
        showErrorMessage('You are already subscribed to "' + url + '".');
      } else {
        // app.console.log('Subscribing to %s', url);
        app.updateFeed(db, {'url': url},
          onSubscribeComplete, SUBSCRIBE_TIMEOUT);
      }
    });
  });
}

function showErrorMessage(msg) {

  var dismissClickListener = function(event) {
    event.target.removeEventListener('click', dismissClickListener);
    container.parentNode.removeChild(container);
  }

  var oldContainer = document.getElementById('options_error_message');
  if(oldContainer) {
    document.getElementById('options_dismiss_error_button').removeEventListener(
      'click', dismissClickListener);
    oldContainer.parentNode.removeChild(oldContainer);
  }

  var container = document.createElement('div');
  container.setAttribute('id','options_error_message');

  var elMessage = document.createElement('span');
  elMessage.innerHTML = app.escapeHTML(msg);
  container.appendChild(elMessage);

  var elDismiss = document.createElement('input');
  elDismiss.setAttribute('type','button');
  elDismiss.setAttribute('id','options_dismiss_error_button');
  elDismiss.setAttribute('value','Dismiss');
  elDismiss.addEventListener('click', dismissClickListener);
  container.appendChild(elDismiss);
  document.body.appendChild(container);
  app.fade(container, 0.1, 100);
}

function onSubscribeComplete(feed, entriesProcessed, entriesAdded) {
  if(feed.error) {
    var errorMessage = feed.error || 'An unknown error occurred.';
    showErrorMessage('Unable to subscribe to "'+ feed.url+'". ' + 
      errorMessage);
    return;
  }

  app.console.log('Subscribed to %s, processed %s entries, added %s entries', 
    feed.title, entriesProcessed, entriesAdded);
  app.updateBadge();

  app.showNotification('Subscribed to ' + feed.title + '. Found ' + entriesAdded + ' new articles.');

  // Add the feed to the feed list
  listFeed(feed);

  // Broadcast the subscription event
  chrome.runtime.sendMessage({'type':'subscribe','feed':feed.id});
  
  
  // TODO: show something in the UI in case notification was not clear enough?
}

function loadFeeds() {

  // Load feeds from the database and print them out
  var feedCount = 0;

  var onComplete = function() {
    if(feedCount == 0) {
      noFeedsMessage.style.display = 'block';
      feedTable.style.display = 'none';
    } else {
      noFeedsMessage.style.display = 'none';
      feedTable.style.display = 'block';
    }
  };

  var handleFeed = function(feed) {
    feedCount++;
    listFeed(feed);
  };

  app.model.connect(function(db) {
    app.model.forEachFeed(db, handleFeed, onComplete);
  });
}

function listFeed(feed) {

  var favIconURL = app.getFavIcon(feed.link);
  if(!favIconURL) {
    // console.log('No fav icon found for %s', feed.title);
    favIcon = 'img/rss_icon_trans.gif';
  }

  var row = document.createElement('tr');
  var template = [
    '<td><img src="',favIconURL,'" style="max-width:19px;"></td>',
    '<td>',app.escapeHTML(feed.title) || 'Untitled','</td>',
    '<td><input type="text" class="feed_list_url_input" value="',
    app.escapeHTMLInputValue(feed.url),
    '"></td>',
    '<td>',
    '<input type="button" value="Unsubscribe" feed="',
    feed.id,
    '"/>',
    '</td>'
  ];
  row.innerHTML = template.join('');

  var unsubButton = row.querySelector('input[type=button]');
  unsubButton.onclick = onUnsubscribeButtonClicked;
  feedTable.appendChild(row);

  // TODO: check it is visible and hide the no feeds message
};

function onUnsubscribeButtonClicked(event) {
  var unsubButton = event.target;
  var feedId = parseInt(unsubButton.attributes.feed.value);
  app.model.connect(function(db) {
    app.model.unsubscribe(db, feedId, function() {
      // Remove the feed from the list
      var row = unsubButton.parentNode.parentNode;
      feedTable.removeChild(row);

      if(feedTable.childNodes.length == 0) {
        feedTable.style.display = 'none';
        noFeedsMessage.style.display = 'block';
      }
      
      chrome.runtime.sendMessage({'type':'unsubscribe', 'feed': feedId});

      app.updateBadge();
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('subscribe').onsubmit = onSubscribeSubmit;
  noFeedsMessage = document.getElementById('nosubscriptions');
  feedTable = document.getElementById('feedtable');

  loadFeeds();
});
