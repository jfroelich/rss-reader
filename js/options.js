// Options user interface lib
(function(global){
'use strict';

var app = chrome.extension.getBackgroundPage();

var SUBSCRIBE_TIMEOUT = 5000;

// Keep track of the currently displayed section 
// and selected menu item
var currentSection, currentMenuItem;

// Map between menu items and sections
var menuItemIdToSectionIdMap = {
  'mi-add-subscription':'divsubscribe',
  'mi-discover-subscription':'divdiscover',
  'mi-view-subscriptions':'divfeedlist',
  'mi-view-settings':'divoptions',
  'mi-view-help':'divhelp',
  'mi-view-about':'divabout'
};

// Menu click handler
function navigationClick(event) {
  showSection(event.target);
}

// Update the menu and show the desired section
function showSection(menuItem) {
  // Ignore re-selection
  if(currentMenuItem == menuItem) {
    return;
  }

  // Update the menu
  menuItem.classList.add('navigation-item-selected');
  
  // Deselect only if set (as not set on page load)
  if(currentMenuItem) {
    currentMenuItem.classList.remove('navigation-item-selected');
  }
  
  // Hide the old section if present (as not set on page load)
  if(currentSection) {
    currentSection.style.display = 'none';
  }
  
  // Get the section corresponding to the menu item
  var section = document.getElementById(
    menuItemIdToSectionIdMap[menuItem.id]);

  // Show the new section
  section.style.display = 'block';

  // Update currently selected menu item and displayed section
  currentMenuItem = menuItem;
  currentSection = section;
}

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

  // Disable future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor) {
    console.log('subscription in progress, ignoring subscription button click');
    return;
  }

  // Stop and warn if we did not get a valid url
  if(!app.URI.isValid(app.URI.parse(url))) {
    showErrorMessage('"' + url + '" is not a valid webpage location.');
    return;
  }

  // Stop and warn if we are not online
  if(navigator.hasOwnProperty('onLine') && !navigator.onLine) {
    console.log('!navigator.onLine');
    showErrorMessage('Unable to subscribe while offline.');
    return;
  }

  // Reset the input
  elementAddURL.value = '';

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

function showSubscriptionMonitor() {
  var oldContainer = document.getElementById('options_subscription_monitor');
  if(oldContainer) {
    console.log('old container still present');
    
    // Note: instead of removing think how to reuse so we avoid this
    // remove then add ugliness (in the UI, and the code too). Also do 
    // this for the error message code.
    // BUG: possible bug if container is concurrently fading out?
    oldContainer.parentNode.removeChild(oldContainer);
  }

  var container = document.createElement('div');
  container.setAttribute('id','options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);
}

// Add a message to the subscription monitor element
function updateSubscriptionMonitor(message) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    console.log('no subscription monitor container when trying to update');
    return;
  }

  var elMessage = document.createElement('p');
  elMessage.appendChild(document.createTextNode(message));
  container.appendChild(elMessage);
}

function hideSubscriptionMonitor(onComplete) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    console.log('cannot hide monitor');
    if(onComplete) onComplete();
    return;
  }

  fade(container, 2, 2, function() {
    document.body.removeChild(container);
    if(onComplete) onComplete();
  });
}

function showErrorMessage(msg) {
  var dismissClickListener = function(event) {
    event.target.removeEventListener('click', dismissClickListener);
    if(container) {
      container.parentNode.removeChild(container);
    } else {
      console.error('container was undefined when clicking dismiss');
    }
  }

  var oldContainer = document.getElementById('options_error_message');
  if(oldContainer) {
    document.getElementById('options_dismiss_error_button').removeEventListener(
      'click', dismissClickListener);
    oldContainer.parentNode.removeChild(oldContainer);
  }

  var container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.style.opacity = '0';

  var elMessage = document.createElement('span');
  elMessage.appendChild(document.createTextNode(msg));
  container.appendChild(elMessage);

  var elDismiss = document.createElement('input');
  elDismiss.setAttribute('type','button');
  elDismiss.setAttribute('id','options_dismiss_error_button');
  elDismiss.setAttribute('value','Dismiss');
  elDismiss.addEventListener('click', dismissClickListener);
  container.appendChild(elDismiss);
  document.body.appendChild(container);
  fade(container, 2, 0);
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

  // Add the feed to the feed list
  appendFeed(feed);
  
  // Update the total feed count message
  updateFeedCountMessage();

  // Broadcast the subscription event
  chrome.runtime.sendMessage({'type':'subscribe','feed':feed.id});
}

// Load feeds from the database and print them out
function initFeedList() {
  // Track number of feeds loaded
  var feedCount = 0;

  // NOTE: UNEXPECTED BEHAVIOR. onComplete is getting called
  // every single time a feed is handled. I think I am interpreting
  // how transaction.oncomplete works incorrectly.

  // Callback for when all feeds have been loaded
  var onComplete = function() {
    if(feedCount == 0) {
      document.getElementById('nosubscriptions').style.display = 'block';
      document.getElementById('feedlist').style.display = 'none';
    } else {
      document.getElementById('nosubscriptions').style.display = 'none';
      document.getElementById('feedlist').style.display = 'block';
    }
    
    // updateFeedCountMessage();
  };

  // Callback for when one feed has been loaded
  var handleFeed = function(feed) {
    feedCount++;
    appendFeed(feed);
    
    // Update this every call, so we get a progressive update effect
    updateFeedCountMessage();
  };

  // Connect and iterate over feeds
  app.model.connect(function(db) {
    app.model.forEachFeed(db, handleFeed, onComplete);
  });
}

function updateFeedCountMessage() {  
  var feedList = document.getElementById('feedlist');
  var feedCount = feedList.childNodes.length;
  var feedCountMessage = document.getElementById('subscription-count');
  if(feedCount == 0) {
    feedCount.textContent = '';
  } else {
    feedCountMessage.textContent = ' ('+ feedCount +')';
  }
}

function appendFeed(feed) {
  // Prepare properties for display
  var prepped = {
    favIconURL: app.getFavIcon(feed.link) || 'img/rss_icon_trans.gif',
    favIconAltText: app.escapeHTMLAttribute(feed.title) || '',
    title: app.escapeHTML(feed.title) || 'Untitled',
    url: app.escapeHTMLAttribute(feed.url),
    description: ''
  };
  if(feed.description) {
    prepped.description = ' - ' + app.escapeHTML(feed.description);
  }

  var listItem = document.createElement('li');
  var template = [
    '<img src="',prepped.favIconURL,'" title="',prepped.favIconAltText,'">',
    '<span title="',prepped.url,'">',prepped.title,'</span>',
    '<span class="feed-description">',prepped.description,'</span>',
    //'<br>Active: <span>?</span>',
    //'<input type="button" value="Unsubscribe" feed="',feed.id,'"/>'
    '<button feed="',feed.id,'">Unsubscribe</button>'
  ];
  listItem.innerHTML = template.join('');

  // Attach unsubscribe handler
  var unsubButton = listItem.querySelector('button');
  unsubButton.addEventListener('click',onUnsubscribeButtonClicked);

  // Add it
  document.getElementById('feedlist').appendChild(listItem);
};

function initBodyFontMenu() {
  var menu = document.getElementById('select_body_font');
  var preview = document.getElementById('body_font_preview');
  var currentFontFamily = localStorage.BODY_FONT_FAMILY;
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);
  
  for(var key in app.FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.value = key;
    if(key == currentFontFamily)
      fontOption.selected = true;
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }
  
  preview.className = app.FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event) {
    var value = event.target.value;
    console.log('Changing body font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = app.FONT_FAMILIES[value] || '';
    
    // Update the stored setting
    if(value) {
      localStorage.BODY_FONT_FAMILY = value;
    } else {
      delete localStorage.BODY_FONT_FAMILY;
    }

    // Notify other views of the change
    chrome.runtime.sendMessage({'type':'bodyFontChanged'});    
  });
}

function initHeaderFontMenu() {
  
  var menu = document.getElementById('select_header_font');
  var preview = document.getElementById('header_font_preview');
  var currentFontFamily = localStorage.HEADER_FONT_FAMILY;
  
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);

  for(var key in app.FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.setAttribute('value',key);
    if(key == currentFontFamily)
      fontOption.setAttribute('selected','');
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }

  preview.className = app.FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event){
    // Get the new value
    var value = event.target.value;
    
    console.log('Changing header font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = app.FONT_FAMILIES[value] || '';
    
    // Update the stored setting
    if(value) {
      localStorage.HEADER_FONT_FAMILY = value;
    } else {
      delete localStorage.HEADER_FONT_FAMILY;
    }

    // Notify other views of the change
    chrome.runtime.sendMessage({'type':'headerFontChanged'});
  });
}

// Handle unsubscribe for a specific feed in feed list
function onUnsubscribeButtonClicked(event) {
  var unsubButton = event.target;
  var feedId = parseInt(unsubButton.attributes.feed.value);
  app.model.connect(function(db) {
    app.model.unsubscribe(db, feedId, function() {
      // Remove the feed from the list
      var listItem = unsubButton.parentNode.parentNode;
      if(listItem) {
        // Remove it from the list
        document.getElementById('feedlist').removeChild(listItem);
        
        // Update the count message
        updateFeedCountMessage();
      } else {
        console.log('no list item found to remove when unsubscribe');
      }

      if(document.getElementById('feedlist').childNodes.length == 0) {
        document.getElementById('feedlist').style.display = 'none';
        document.getElementById('nosubscriptions').style.display = 'block';
      }
      
      chrome.runtime.sendMessage({'type':'unsubscribe', 'feed': feedId});

      app.updateBadge();
    });
  });
}

function initSettingsSection() {
  initHeaderFontMenu();
  initBodyFontMenu();
}

function initAboutSection() {
  var manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name || '?';
  document.getElementById('extension-version').textContent = manifest.version || '?';
  document.getElementById('extension-author').textContent = manifest.author || '?';
  document.getElementById('extension-description').textContent = manifest.description || '';
}

function initNavigationMenu() {
  // Attach navigation menu click handler
  var navigationItems = document.querySelectorAll('li.navigation-item');
  app.each(navigationItems, function(item) {
    item.addEventListener('click', navigationClick);
  });
}

function initOptionsPage(event) {
  
  initNavigationMenu();

  // Select the default navigation item and show the default section
  showSection(document.getElementById('mi-view-subscriptions'));

  // Initialize the Add subscription section
  // Attach the subscription form submit handler
  document.getElementById('subscription-form').addEventListener('submit', onSubscribeSubmit);

  // Initialize the Discover feeds section
  // TODO: when implemented

  // Initialize the Manage subscriptions section
  initFeedList();  

  // Initialize the Settings section
  initSettingsSection();

  // Initialize the About section
  initAboutSection();
}

// Export globals
global.initOptionsPage = initOptionsPage;

}(this));

// Bindings
document.addEventListener('DOMContentLoaded', initOptionsPage);