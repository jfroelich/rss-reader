var app = app || chrome.extension.getBackgroundPage();

var ELEMENT_MANAGE_FEEDS_LIST, ELEMENT_NO_SUBSCRIPTIONS;

document.addEventListener('DOMContentLoaded', initManageFeedsList);

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
    });
  });
}

function updateFeedCountMessage() {  
  var feedCount = ELEMENT_MANAGE_FEEDS_LIST.childNodes.length;
  var feedCountMessage = document.getElementById('subscription-count');
  if(feedCount == 0) {
    feedCount.textContent = '';
  } else {
    feedCountMessage.textContent = ' ('+ feedCount +')';
  }
}

// TODO: stop using custom feed attribute
// TODO: use one event listener for the entire list, not per button
function appendFeed(feed) {
  
  var listItem = document.createElement('li');
  
  var favIcon = document.createElement('img');
  favIcon.src = app.getFavIconURL(feed.link);
  favIcon.title = app.escapeHTMLAttribute(feed.title) || '';
  listItem.appendChild(favIcon);
  
  var title = document.createElement('a');
  title.href = app.escapeHTMLAttribute(feed.link);
  title.title = app.escapeHTMLAttribute(feed.url);
  title.setAttribute('target','_blank');
  title.textContent = feed.title || 'Untitled';
  listItem.appendChild(title);
  
  var description = document.createElement('span');
  description.setAttribute('class','feed-description');
  description.textContent = app.stripTags(feed.description) || '';
  listItem.appendChild(description);
  
  var unsub = document.createElement('button');
  unsub.setAttribute('feed',feed.id);
  unsub.value = feed.id;
  unsub.textContent = 'Unsubscribe';
  unsub.addEventListener('click', onUnsubscribeButtonClicked);
  listItem.appendChild(unsub);

  ELEMENT_MANAGE_FEEDS_LIST.appendChild(listItem);
}

// Handle unsubscribe for a specific feed in feed list
function onUnsubscribeButtonClicked(event) {
  
  // Remove ourself since the element will be removed
  event.target.removeEventListener('click', onUnsubscribeButtonClicked);
    
  // TODO: if we use a button we can just use button.value
  var feedId = parseInt(event.target.attributes.feed.value);

  // Remove it regardless of whether call to app.unsubscribe
  // is successful
  // TODO: should not be doing this here
  ELEMENT_MANAGE_FEEDS_LIST.removeChild(event.target.parentNode);
  
  app.unsubscribe(feedId);
}

chrome.runtime.onMessage.addListener(function(event) {
  if(event.type != 'unsubscribe') {
    return;
  }

  // Update the feed list

  // TODO: notice how I am not removing the element here,
  // that kind of seems incorrect. I should probably be removing it here
  // not in the button click handler.
  if(ELEMENT_MANAGE_FEEDS_LIST.childNodes.length == 0) {
    ELEMENT_MANAGE_FEEDS_LIST.style.display = 'none';
    ELEMENT_NO_SUBSCRIPTIONS.style.display = 'block';
  }

  // Update the feed counter element above the feed list
  updateFeedCountMessage();
});