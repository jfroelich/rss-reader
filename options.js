// Options user interface lib
(function(global){
'use strict';

// Handle of the background page
var app = chrome.extension.getBackgroundPage();

// Keep track of the currently displayed section 
// and selected menu item
var currentSection, currentMenuItem;

// Default timeout(ms) for subscribing
var SUBSCRIBE_TIMEOUT = 5000;

// Max chars for create content filter feed menu
var CREATE_CONTENT_FILTER_FEED_MENU_MAX_TEXT_LENGTH = 30;


// Map between menu items and sections
// TODO: embed custom attribute in the li tag itself
// and read from that, then deprecate this map.
var menuItemIdToSectionIdMap = {
  'mi-add-subscription':'section-add-subscription',
  'mi-discover-subscription':'divdiscover',
  'mi-view-subscriptions':'divfeedlist',
  'mi-display-settings':'section-display-settings',
  'mi-content-filters':'section-content-filters',
  'mi-view-help':'divhelp',
  'mi-view-about':'divabout'
};

// Menu click handler
function navigationClick(event) {
  showSection(event.target);
}

// Update the menu and show the desired section
function showSection(menuItem) {
  
  if(!menuItem) {
    console.error('undefined menuItem');
    return;
  }

  // Ignore re-selection
  if(currentMenuItem == menuItem) {
    console.log('Ignoring reclick of same menu item');
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

function discoverSubscribeClick(event) {
  var button = event.target;
  var url = button.value;
  if(!url) {
    console.log('no url in discover subscribe click');
    return;
  }

  // Ignore future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    console.log('subscription in progress, ignoring subscription button click');
    return;
  }

  startSubscription(url);
}

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

  // Navigate back to the view feeds list
  showSection('mi-view-subscriptions');

  // Add the feed to the feed list
  appendFeed(feed);
  
  // Update the total feed count message
  // Don't call this here since we call it in appendFeed
  //updateFeedCountMessage();

  // Broadcast the subscription event
  chrome.runtime.sendMessage({'type':'subscribe','feed':feed.id});
}

function onDiscoverFormSubmit(event) {

  // Prevent the form submission that would normally occur
  event.preventDefault();

  var queryElement = document.getElementById('discover-query');
  var query = queryElement.value ? queryElement.value.trim() : '';
  if(!query) {

    // Return false to prevent form submit
    return false;
  }

  // Suppress re-clicks
  if(document.getElementById('discover-in-progress').style.display == 'block') {
    console.log('Cancelling, search already in progress');

    // Return false to prevent form submit
    return false;
  }

  // Show that we are in progress
  document.getElementById('discover-in-progress').style.display='block';

  console.log('Query: %s', query);

  // Perform the query
  app.discoverFeeds(query,onDiscoverFeedsComplete, onDiscoverFeedsError, 5000);
  
  // Return false to prevent form submit
  return false;
}

function onDiscoverFeedsComplete(query, results) {
  console.log('Searching for %s yielded %s results', query, results.length);

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
      '" target="_blank">',result.title,'</a> ',app.truncate(snippet,400)

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
  
  // Report a visual error
  showErrorMessage('An error occurred. Details: ' + errorMessage);
}

function updateFeedCountMessage() {  
  var feedList = document.getElementById('feedlist');
  var feedCount = feedList ? feedList.childNodes.length : 0;
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
    favIconURL: app.getFavIconURL(feed.link),
    favIconAltText: app.escapeHTMLAttribute(feed.title) || '',
    title: app.escapeHTML(feed.title) || 'Untitled',
    link: app.escapeHTMLAttribute(feed.link),
    url: app.escapeHTMLAttribute(feed.url)
  };
  if(feed.description) {
    prepped.description = app.escapeHTML(feed.description);
  }

  var listItem = document.createElement('li');
  var template = [
    '<img src="',prepped.favIconURL,'" title="',prepped.favIconAltText,'">',
    '<a href="',prepped.link,'" title="',prepped.url,'" target="_blank">',prepped.title,'</a>',
    ' <span class="feed-description">',prepped.description,'</span>',
    //'<br>Active: <span>?</span>',
    // TODO: should simply use button.value, not a custom attribute
    '<button feed="',feed.id,'">Unsubscribe</button>'
  ];
  listItem.innerHTML = template.join('');

  // Attach unsubscribe handler
  var unsubButton = listItem.querySelector('button');
  unsubButton.addEventListener('click',onUnsubscribeButtonClicked);

  // Add it
  document.getElementById('feedlist').appendChild(listItem);
};

function createContentFilterClick(event) {
  console.log('Clicked create filter');

  var feedMenu = document.getElementById('create-filter-feed');
  var typeMenu = document.getElementById('create-filter-type');

  var rule = {
    'feed': parseInt(feedMenu.options[feedMenu.selectedIndex].value),
    'type': typeMenu.options[typeMenu.selectedIndex].value,
    'match': document.getElementById('create-filter-match').value || ''
  };

  app.createContentFilterRule(rule);
}

function initBodyFontMenu() {
  var menu = document.getElementById('select_body_font');
  var preview = document.getElementById('body_font_preview');
  var currentFontFamily = localStorage.BODY_FONT_FAMILY;
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);
  
  for(var key in FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.value = key;
    if(key == currentFontFamily)
      fontOption.selected = true;
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }
  
  preview.className = FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event) {
    var value = event.target.value;
    console.log('Changing body font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = FONT_FAMILIES[value] || '';
    
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

  for(var key in FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.setAttribute('value',key);
    if(key == currentFontFamily)
      fontOption.setAttribute('selected','');
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }

  preview.className = FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event){
    // Get the new value
    var value = event.target.value;
    
    console.log('Changing header font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = FONT_FAMILIES[value] || '';
    
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
  // TODO: if we use a button we can just use button.value
  var feedId = parseInt(event.target.attributes.feed.value);
  
  // Remove it regardless of whether call to app.unsubscribe
  // is successful
  document.getElementById('feedlist').removeChild(event.target.parentNode);
  
  app.unsubscribe(feedId);
}

function contentFilterCreatedMessageListener(event) {
  if(event.type != 'createContentFilter') {
    return;
  }
  
  if(!event.rule) {
    console.error('undefined rule received');
    return;
  }
  
  // Append the rule to the list
  appendContentFilterRule(event.rule);
  
  // TODO: scroll to the new rule???
}

function appendContentFilterRule(rule) {
  console.log('Appending content filter rule %s', JSON.stringify(rule));
  var list = document.getElementById('content-filters-list');
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = app.getRuleTextualFormat(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  
  button.addEventListener('click', removeContentFilterClick);
  
  listItem.appendChild(button);
  list.appendChild(listItem);
}

function removeContentFilterClick(event) {
  console.log('Clicked remove content filter, filter id is %s', event.target.value);
}

function initOptionsPage(event) {
  // Initialize the navigation menu
  app.each(document.querySelectorAll('li.navigation-item'), function(item) {
    item.addEventListener('click', navigationClick);
  });

  // Select the default navigation item and show the default section
  showSection(document.getElementById('mi-view-subscriptions'));

  // Initialize the Add subscription section
  document.getElementById('subscription-form').addEventListener('submit', onSubscribeSubmit);

  // Initialize the Discover feeds section
  document.getElementById('discover-feeds').addEventListener('submit', onDiscoverFormSubmit);

  // Initialize the Manage subscriptions section
  // Connect and iterate over feeds
  var feedCount = 0;
  var feedList = document.getElementById('feedlist');
  var noSubscriptionsMessage = document.getElementById('nosubscriptions');
  app.model.connect(function(db) {
    app.model.forEachFeed(db, function(feed) {
      feedCount++;
      appendFeed(feed);
      updateFeedCountMessage();
    }, function() {
      // Show or hide the no-subscriptions message and the feed list
      if(feedCount == 0) {
        noSubscriptionsMessage.style.display = 'block';
        feedList.style.display = 'none';
      } else {
        noSubscriptionsMessage.style.display = 'none';
        feedList.style.display = 'block';
      }
    });
  });

  // Initialize the Display settings section
  initHeaderFontMenu();
  initBodyFontMenu();

  // Initialize the Content filters section
  
  // Initialize the Create content filter subsection
  var createFilterFeedMenu = document.getElementById('create-filter-feed');
  app.model.connect(function(db){
    var feeds = [];
    app.model.forEachFeed(db, function(feed){
      feeds.push({'id':feed.id,'title':feed.title || 'Untitled'});
    }, function() {
      // Sort the menu alphabetically by title
      feeds.sort(function(a,b) { return a.title > b.title ? 1 : -1; });

      feeds.forEach(function(feed){
        var option = document.createElement('option');
        option.value = feed.id;
        
        // Set the title attribute to help the user disambiguate post truncation
        // conflated option text
        // TODO: test whether I need to strip quotes here
        option.title = feed.title.replace('"','&quot;');

        // Hard limit to 30 to prevent large title from messing up the form
        option.textContent = app.truncate(feed.title,
          CREATE_CONTENT_FILTER_FEED_MENU_MAX_TEXT_LENGTH);

        createFilterFeedMenu.appendChild(option);
      });
    });
  });

  var createFilterTypeMenu = document.getElementById('create-filter-type');
  app.CONTENT_FILTER_TYPES.forEach(function(type) {
    var option = document.createElement('option');
    option.value = type.value;
    option.textContent = type.text;
    createFilterTypeMenu.appendChild(option);
  });

  var createContentFilterAction = document.getElementById('create-filter-action');
  createContentFilterAction.addEventListener('click', createContentFilterClick);

  // Load up and display the content rules
  var contentFiltersList = document.getElementById('content-filters-list');
  
  var rules = app.getContentFilterRules();
  console.log('Initializing content filters rules list. %s rules found.', rules.length);
  rules.forEach(function(rule){
    appendContentFilterRule(rule);
  });
  


  // Initialize the About section
  var manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name || '?';
  document.getElementById('extension-version').textContent = manifest.version || '?';
  document.getElementById('extension-author').textContent = manifest.author || '?';
  document.getElementById('extension-description').textContent = manifest.description || '';
  document.getElementById('extension-homepage').textContent = manifest.homepage_url || '';
}


function unsubscribeMessageListener(event) {
  
  // Only handle unsubscribe messages
  if(event.type != 'unsubscribe') {
    return;
  }

  // Only handle messages with the proper event properties set
  // valid feed id can never be zero so this works
  if(!event.feed) {
    console.error('unsubscribe event handler did not get feed id');
    return;
  }

  // Update the feed list
  // TODO: notice how I am not removing the element here,
  // that kind of seems incorrect. I should probably be removing it here
  // not in the button click handler.
  var feedList = document.getElementById('feedlist');
  if(feedList.childNodes.length == 0) {
    feedList.style.display = 'none';
    document.getElementById('nosubscriptions').style.display = 'block';
  }

  // Update the feed counter element above the feed list
  updateFeedCountMessage();

  // TODO: Remove content filter rules specific to the feed
  // from the content filter ui
  // NOTE: actually i think that i am sending a command to app
  // background and therefore I should not be doing this here. that 
  // should happen in a separate callback? that way I can use the same 
  // handler for when user deletes a rule he has created manually, or 
  // as a result of some console command

  // Remove the feed from the create content filter menu
  var feedOption = document.getElementById('create-filter-feed').querySelector('option[id='+event.feed+']');
  if(feedOption) {
    console.log('Removing feed with id %s from create content filter form', event.feed);
    feedOption.parentNode.removeChild(feedOption);
  } else {
    console.error('Could not locate feed in create content filter feed menu for id %s', event.feed);
  }

}

// Bindings
chrome.runtime.onMessage.addListener(unsubscribeMessageListener);
chrome.runtime.onMessage.addListener(contentFilterCreatedMessageListener);

document.addEventListener('DOMContentLoaded', initOptionsPage);

}(this));