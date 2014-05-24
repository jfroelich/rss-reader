var app = chrome.extension.getBackgroundPage();

var ELEMENT_MANAGE_FEEDS_LIST, ELEMENT_NO_SUBSCRIPTIONS;

// Initialize the Manage subscriptions section
function initManageFeedsList(event) {
  document.removeEventListener('DOMContentLoaded', initManageFeedsList);

  ELEMENT_MANAGE_FEEDS_LIST = document.getElementById('feedlist');
  ELEMENT_NO_SUBSCRIPTIONS = document.getElementById('nosubscriptions');

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
// TODO: use one event listener for the entire list, not per button
function appendFeed(feed, insertedSort) {
  
  var listItem = document.createElement('li');
  listItem.setAttribute('sort-key', feed.title);
  listItem.setAttribute('feed',feed.id);
  listItem.setAttribute('title', app.strings.stripTags(feed.description) || '');
  
  // TODO: remember to remove this event listener if unsubscribing
  listItem.onclick = feedListItemClick;
  
  var favIcon = document.createElement('img');
  favIcon.src = app.favIcon.getURL(feed.link);
  //feed.title && (favIcon.title = feed.title);
  listItem.appendChild(favIcon);
  
  var title = document.createElement('span');
  //title.setAttribute('title', app.strings.stripTags(feed.description) || '');
  title.textContent = app.strings.truncate(feed.title,50) || 'Untitled';
  listItem.appendChild(title);
  
  /*var title = document.createElement('a');
  title.href = feed.link;
  title.target = '_blank';
  feed.title && (title.textContent = feed.title);
  listItem.appendChild(title);*/
  
  /*var description = document.createElement('span');
  description.className = 'feed-description';
  description.textContent = app.strings.stripTags(feed.description) || '';
  listItem.appendChild(description);*/
  
  /*var feedURL = document.createElement('span');
  feedURL.className = 'feed-list-url';
  feedURL.textContent = feed.url;
  listItem.appendChild(feedURL);*/

  if(insertedSort) {
    var currentItems = ELEMENT_MANAGE_FEEDS_LIST.childNodes;
    var added = false;
    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
      if(window.indexedDB.cmp(feed.title, currentKey) == -1) {
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
  
  // Update the feed-details section with the information for this feed.
  populateFeedDetailsSection(feedId);
  
  showSection(document.getElementById('mi-feed-details'));
}

function populateFeedDetailsSection(feedId) {
  
}


function updateFeedCountMessage() {  
  var feedCount = ELEMENT_MANAGE_FEEDS_LIST.childElementCount;
  var feedCountMessage = document.getElementById('subscription-count');
  feedCountMessage.textContent = 
    feedCount ? ' ('+ feedCount +')' : '';
}

// Handle unsubscribe for a specific feed in feed list
function onUnsubscribeButtonClicked(event) {
  event.target.removeEventListener('click', onUnsubscribeButtonClicked);
  app.feedUpdater.unsubscribe(parseInt(event.target.value));
}

chrome.runtime.onMessage.addListener(function(event) {
  if(event.type != 'unsubscribe') return;

  var feedListItem = ELEMENT_MANAGE_FEEDS_LIST.querySelector('li[feed="'+event.feed+'"]');
  if(feedListItem) ELEMENT_MANAGE_FEEDS_LIST.removeChild(feedListItem);
  if(ELEMENT_MANAGE_FEEDS_LIST.childElementCount == 0) {
    ELEMENT_MANAGE_FEEDS_LIST.style.display = 'none';
    ELEMENT_NO_SUBSCRIPTIONS.style.display = 'block';
  }

  updateFeedCountMessage();
});

document.addEventListener('DOMContentLoaded', initManageFeedsList);