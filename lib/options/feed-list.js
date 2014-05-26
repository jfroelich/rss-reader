var app = chrome.extension.getBackgroundPage();

var ELEMENT_MANAGE_FEEDS_LIST, ELEMENT_NO_SUBSCRIPTIONS;

// Initialize the Manage subscriptions section
function initManageFeedsList(event) {
  document.removeEventListener('DOMContentLoaded', initManageFeedsList);

  ELEMENT_MANAGE_FEEDS_LIST = document.getElementById('feedlist');
  ELEMENT_NO_SUBSCRIPTIONS = document.getElementById('nosubscriptions');

  var buttonUnsubscribe = document.getElementById('details-unsubscribe');
  buttonUnsubscribe.onclick = onUnsubscribeButtonClicked;

  // Iterate over feeds
  var feedCount = 0;
  app.model.connect(function(db) {
    app.model.forEachFeed(db, function(feed) {
      feedCount++;
      appendFeed(feed);
      updateFeedCountMessage();
    }, function() {
      // Show or hide the no-subscriptions message and the feed list
      if(feedCount == 0) {
        ELEMENT_NO_SUBSCRIPTIONS.style.display = 'block';
        ELEMENT_MANAGE_FEEDS_LIST.style.display = 'none';
      } else {
        ELEMENT_NO_SUBSCRIPTIONS.style.display = 'none';
        ELEMENT_MANAGE_FEEDS_LIST.style.display = 'block';
      }
    }, true);
  });
}

// TODO: stop using custom feed attribute
function appendFeed(feed, insertedSort) {

  if(!feed) {
    throw 'feed undefined';
  }
  
  var listItem = document.createElement('li');
  listItem.setAttribute('sort-key', feed.title);
  listItem.setAttribute('feed',feed.id);
  listItem.setAttribute('title', app.strings.stripTags(feed.description) || '');
  
  // TODO: remember to remove this event listener if unsubscribing
  listItem.onclick = feedListItemClick;
  
  var favIcon = document.createElement('img');
  favIcon.src = app.favIcon.getURL(feed.link);
  if(feed.title) favIcon.title = feed.title;
  listItem.appendChild(favIcon);
  
  var title = document.createElement('span');
  title.textContent = app.strings.truncate(feed.title,50) || 'Untitled';
  listItem.appendChild(title);

  if(insertedSort) {
    var currentItems = ELEMENT_MANAGE_FEEDS_LIST.childNodes;
    var added = false;
    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
      if(window.indexedDB.cmp(feed.title || '', currentKey || '') == -1) {
        added = true;
        ELEMENT_MANAGE_FEEDS_LIST.insertBefore(listItem, currentItems[i]);
        break;        
      }
    }

    if(!added) {
      ELEMENT_MANAGE_FEEDS_LIST.appendChild(listItem);
    }
  } else {
    ELEMENT_MANAGE_FEEDS_LIST.appendChild(listItem);  
  }
}

function feedListItemClick(event) {
  var listItem = event.currentTarget;
  var feedId = parseInt(listItem.getAttribute('feed'));
  populateFeedDetailsSection(feedId);
  navigation.showSection(document.getElementById('mi-feed-details'));
  window.scrollTo(0,0);
}

function populateFeedDetailsSection(feedId) {
  var elementTitle = document.getElementById('details-title');
  var elementFavIcon = document.getElementById('details-favicon');
  var elementDescription = document.getElementById('details-feed-description');
  var elementURL = document.getElementById('details-feed-url');
  var elementLink = document.getElementById('details-feed-link');
  var buttonUnsubscribe = document.getElementById('details-unsubscribe');
  
  app.model.connect(function(db) {
    app.model.getFeedById(db, feedId, function(feed) {
      
      elementTitle.textContent = feed.title || 'Untitled';
      elementFavIcon.setAttribute('src', app.favIcon.getURL(feed.url));
      elementDescription.textContent = app.strings.stripTags(feed.description) || 'No description';
      elementURL.textContent = feed.url;
      elementLink.textContent = feed.link;
      
      buttonUnsubscribe.value = feed.id;
    });
  });
}

function updateFeedCountMessage() {  
  var feedCount = ELEMENT_MANAGE_FEEDS_LIST.childElementCount;
  var feedCountMessage = document.getElementById('subscription-count');
  feedCountMessage.textContent = 
    feedCount ? ' ('+ feedCount +')' : '';
}


document.addEventListener('DOMContentLoaded', initManageFeedsList);