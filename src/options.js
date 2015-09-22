// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: implement history? mimic chrome. would need search ability
// TODO: reintroduce $ function for getElementById

// TODO: use a namespace object and get rid of 'options' prefix
// in function names

var lucu = lucu || {};

lucu.options = {};

lucu.options.onMessage = function(message) {
  'use strict';

  if('displaySettingsChanged' == message.type) {
    lucu.style.onChange();
  }
};

chrome.runtime.onMessage.addListener(lucu.options.onMessage);


function hideErrorMessage() {
  'use strict';
  var container = document.getElementById('options_error_message');
  if(!container) return;
  var dismissButton = document.getElementById('options_dismiss_error_button');
  if(dismissButton)
    dismissButton.removeEventListener('click', hideErrorMessage);
  container.remove();
}

function showErrorMessage(message, fadeIn) {
  'use strict';
  hideErrorMessage();

  var elMessage = document.createElement('span');
  elMessage.textContent = message;
  var dismissButton = document.createElement('button');
  dismissButton.setAttribute('id','options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = hideErrorMessage;

  var container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.appendChild(elMessage);
  container.appendChild(dismissButton);

  if(fadeIn) {
    container.style.opacity = '0';
    document.body.appendChild(container);

    lucu.effects.fade(container, 1, 0);

  } else {
    container.style.display = '';
    container.style.opacity = '1';
    document.body.appendChild(container);
  }
}

// TODO: instead of removing and re-adding, reset and reuse

function showSubscriptionMonitor() {
  'use strict';
  resetSubscriptionMonitor();
  var container = document.createElement('div');
  container.setAttribute('id', 'options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);

  var progress = document.createElement('progress');
  progress.textContent = 'working...';
  container.appendChild(progress);
}

function isSubscriptionMonitorDisplayed() {
  'use strict';
  var subMonitor = document.getElementById('options_subscription_monitor');
  return subMonitor && subMonitor.style.display == 'block';
}

function resetSubscriptionMonitor() {
  'use strict';
  var element = document.getElementById('options_subscription_monitor');
  element && element.remove();
}

function updateSubscriptionMonitor(message) {
  'use strict';
  var container = document.getElementById('options_subscription_monitor');
  if(!container) return;
  var paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}

function hideSubsciptionMonitor(onComplete, fadeOut) {
  'use strict';
  var container = document.getElementById('options_subscription_monitor');

  // NOTE: possible bug here, should be checking arguments.length
  var noop = function(){};
  onComplete = onComplete || noop;

  if(!container) {
    return onComplete();
  }

  if(fadeOut) {
    lucu.effects.fade(container, 2, 1, removeAndComplete);
  } else {
    removeAndComplete();
  }

  function removeAndComplete() {
    if(container) container.remove();
    onComplete();
  }
}

var currentMenuItem_;
var currentSection_;

function optionsShowSection(menuItem) {
  'use strict';
  if(!menuItem || currentMenuItem_ == menuItem) {
    return;
  }

  menuItem.classList.add('navigation-item-selected');
  if(currentMenuItem_)
    currentMenuItem_.classList.remove('navigation-item-selected');
  if(currentSection_)
    currentSection_.style.display = 'none';

  var section = document.getElementById(menuItem.getAttribute('section'));

  if(section) {
    section.style.display = 'block';
  } else {
    // If this happens then there is a bug in the UI
    // so this is an actual error
    console.error('Could not locate section for %s', menuItem);
  }
  currentMenuItem_ = menuItem;
  currentSection_ = section;
}

function optionsUpdateFeedCount() {
  'use strict';
  var count = document.getElementById('feedlist').childElementCount;
  var countElement = document.getElementById('subscription-count');

  if(count) {
    if(count > 1000) {
      countElement.textContent = ' (999+)';
    } else {
      countElement.textContent = ' ('+ count +')';
    }
  } else {
    countElement.textContent = '';
  }
}

function optionsAppendFeed(feed, insertedSort) {
  'use strict';
  if(!feed) {
    console.error('feed undefined in optionsAppendFeed');
    return;
  }


  var item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed',feed.id);
  item.setAttribute('title', lucu.string.stripTags(feed.description) || '');
  item.onclick = onFeedListItemClick;
  var favIconElement = document.createElement('img');
  favIconElement.src = lucu.favicon.getURL(feed.link);
  if(feed.title) favIconElement.title = feed.title;
  item.appendChild(favIconElement);

  var title = document.createElement('span');
  title.textContent = lucu.string.truncate(feed.title,300) || 'Untitled';
  item.appendChild(title);

  var feedListElement = document.getElementById('feedlist');

  if(insertedSort) {
    var currentItems = feedListElement.childNodes;
    var added = false;

    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
      if(indexedDB.cmp(feed.title || '', currentKey || '') == -1) {
        added = true;
        feedListElement.insertBefore(item, currentItems[i]);
        break;
      }
    }

    if(!added) {
      feedListElement.appendChild(item);
    }
  } else {
    feedListElement.appendChild(item);
  }
}

function onEnableSubscriptionPreviewChange() {
  'use strict';
  if(this.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
}

function showOrSkipSubscriptionPreview(url) {
  'use strict';
  // TODO: do not augment during preview, it takes too long

  console.debug('showOrSkipSubscriptionPreview %s',url);
  hideSubscriptionPreview();

  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    console.debug('subscription preview not enabled, skipping preview');
    startSubscription(url);
    return;
  }

  if(!navigator.onLine) {
    console.debug('cannot preview while offline, skipping preview');
    startSubscription(url);
    return;
  }

  // Show the preview area
  document.getElementById('subscription-preview').style.display = 'block';
  // Start an indeterminate progress bar.
  document.getElementById('subscription-preview-load-progress').style.display = 'block';

  // invalid url or parse error or exists
  var onerror = function(error) {

    // NOTE: use console.debug, not error, because this is not an error in the code
    // but an error fetching. reserve calls to console.error when encountering
    // something like a TypeError.

    console.debug('error fetching %o for preview', error);

    // If an error occurs hide the preview elements.
    hideSubscriptionPreview();

    // TODO: inspect error props and show a better error message.
    // There could be parsing errors, HTTP status !200 errors,
    // unhandled content type errors, invalid xml errors, etc.
    showErrorMessage('Unable to fetch ' + url);
  };

  var timeout = 10 * 1000;

  function onFetchSuccess(result) {
    // Stop the indeterminate progress bar.
    document.getElementById(
      'subscription-preview-load-progress').style.display = 'none';

    // Show the title
    //document.getElementById('subscription-preview-title').style.display = 'block';
    document.getElementById('subscription-preview-title').textContent =
      result.title || 'Untitled';

    // Update the value of the continue button so its click handler
    // can get the vvalue for subscription
    document.getElementById(
      'subscription-preview-continue').value = result.url;

    // result.title and  result.entries
    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No entries found to preview';
      document.getElementById(
        'subscription-preview-entries').appendChild(item);
    }

    // Show up to 5 entries.
    for(var i = 0, len = Math.min(5,result.entries.length); i < len;i++) {
      var entry = result.entries[i];
      var item = document.createElement('li');
      item.innerHTML = lucu.string.stripTags(entry.title);
      var content = document.createElement('span');
      content.innerHTML = lucu.string.stripTags(entry.content);
      item.appendChild(content);
      document.getElementById(
        'subscription-preview-entries').appendChild(item);
    }
  }

  // TODO: check if already subscribed before preview?
  lucu.fetch.fetchFeed(url, onFetchSuccess, onerror, timeout);
}

function hideSubscriptionPreview() {
  'use strict';
  document.getElementById('subscription-preview').style.display = 'none';
  document.getElementById('subscription-preview-entries').innerHTML = '';
}

function startSubscription(url) {
  'use strict';
  // TODO: Use async.js here

  hideSubscriptionPreview();

  if(!lucu.url.isValid(url)) {
    return showErrorMessage('Invalid url "' + url + '".');
  }

  showSubscriptionMonitor();
  updateSubscriptionMonitor('Subscribing...');

  // TODO: react to onerror/onblocked
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    var store = db.transaction('feed').objectStore('feed');
    var index = store.index('schemeless');
    var uri = new URI(url);
    uri.protocol('');
    var schemeless = uri.toString().substring(2);
    var findRequest = index.get(schemeless);
    findRequest.onsuccess = function() {
      var existingFeed = this.result;
      if(existingFeed) {
        return hideSubsciptionMonitor(function() {
          showErrorMessage('Already subscribed to ' + url + '.');
        });
      }

      // TODO: use connectivity.js lib
      if(!navigator.onLine) {
        return lucu.addFeed(db, {url: url}, onSubscriptionSuccessful, console.debug);
      }

      lucu.fetch.fetchFeed(url, onFetchComplete, onFetchError, 10 * 1000);
    };
  };

  function onFetchComplete(remoteFeed) {
    // TODO: subscribing takes too long. Do not augment
    // when subscribing. Just inform the user that articles
    // will be fetched when next poll occurs

    //lucu.augmentEntries(remoteFeed, function() {
    lucu.augment.start(remoteFeed, function() {
      remoteFeed.url = url;
      remoteFeed.fetched = Date.now();
      // TODO: react to db onerror/onblocked
      var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
      request.onerror = console.error;
      request.onblocked = console.error;
      request.onsuccess = function (event) {
        var db = event.target.result;
        lucu.addFeed(db, remoteFeed, function() {
          onSubscriptionSuccessful(remoteFeed, 0, 0);
        }, console.debug);
      };
    });
  }

  function onFetchError(error) {
    console.debug('fetch error %o', error);
    hideSubsciptionMonitor(function() {
      showErrorMessage('An error occurred while trying to subscribe to ' + url);
    });
  }

  function onSubscriptionSuccessful(addedFeed, entriesProcessed, entriesAdded) {

    optionsAppendFeed(addedFeed, true);
    optionsUpdateFeedCount();

    updateSubscriptionMonitor('Subscribed to ' + url);
 
    hideSubsciptionMonitor(function() {
      optionsShowSection(document.getElementById('mi-subscriptions'));
    }, true);

    // Update the badge unread count to include any new articles grabbed as 
    // a result of the subscription?
    // TODO: if subscription just adds feed and does not download articles, 
    // there is no need for this
    lucu.badge.update();

    // Show a notification of the subscription
    // TODO: is it addedFeed.url or addedFeed.link??
    // TODO: title or url will always be defined right? No need for Untitled?
    var title = addedFeed.title || addedFeed.url || 'Untitled';
    lucu.notifications.show('Subscribed to ' + title);
  }
}

function populateFeedDetailsSection(feedId) {
  'use strict';
  // TODO: react to onerror/onblocked

  // TODO: show num entries, num unread/red, etc

  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;

    db.transaction('feed').objectStore('feed').get(feedId).onsuccess =
      function(event) {

      var feed = event.target.result;
      document.getElementById('details-title').textContent = feed.title ||
        'Untitled';
      document.getElementById('details-favicon').setAttribute('src',
        lucu.favicon.getURL(feed.url));
      document.getElementById('details-feed-description').textContent =
        lucu.string.stripTags(feed.description) || 'No description';
      document.getElementById('details-feed-url').textContent = feed.url;
      document.getElementById('details-feed-link').textContent = feed.link;
      document.getElementById('details-unsubscribe').value = feed.id;
    };
  };
}

function onPostPreviewSubscribeClick(event) {
  'use strict';
  var url = event.currentTarget.value;
  hideSubscriptionPreview();
  startSubscription(url);
}

function onFeedListItemClick(event) {
  'use strict';
  var feedId = parseInt(event.currentTarget.getAttribute('feed'));
  populateFeedDetailsSection(feedId);
  // TODO: These calls should really be in an async callback
  // passed to populateFeedDetailsSection
  optionsShowSection(document.getElementById('mi-feed-details'));
  window.scrollTo(0,0);
}

function onSubscribeSubmit(event) {
  'use strict';
  event.preventDefault();// Prevent normal form submission event
  var query = (document.getElementById('subscribe-discover-query').value || '').trim();
  if(!query)
    return false;
  if(document.getElementById('discover-in-progress').style.display == 'block')
    return false;
  // TODO: Suppress resubmits if last query was a search and the
  // query did not change
  if(isSubscriptionMonitorDisplayed())
    return false;
  if(lucu.url.isValid(query)) {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
     document.getElementById('discover-in-progress').style.display='none';
    document.getElementById('subscribe-discover-query').value = '';
    showOrSkipSubscriptionPreview(query);
  } else {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
    document.getElementById('discover-in-progress').style.display='block';
    lucu.queryGoogleFeeds(query, 5000, onDiscoverFeedsComplete,
      onDiscoverFeedsError);
  }
  return false;
}

function discoverSubscribeClick(event) {
  'use strict';
  var button = event.target;
  var url = button.value;
  if(!url)
    return;

  // TODO: Ignore future clicks if error was displayed?

  // Ignore future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block')
    return;

  showOrSkipSubscriptionPreview(url);
}

function onDiscoverFeedsComplete(query, results) {
  'use strict';
  var resultsList = document.getElementById('discover-results-list');
  document.getElementById('discover-in-progress').style.display='none';

  // Need to filter as for some reason the discover feeds
  // service sometimes returns results that do not have a url

  // TODO: maybe this filtering should be a part of the query-google-feeds lib

  // TODO: maybe there is no point in abstracting around discover, there is 
  // pretty much a google query and nothing else

  var displayableResults = results.filter(function(result) {
    return result.url;
  });

  if(displayableResults.length < 1) {
    resultsList.style.display = 'none';
    document.getElementById('discover-no-results').style.display = 'block';
    return;
  }

  if(resultsList.style.display == 'block') {
    resultsList.innerHTML = '';
  } else {
    document.getElementById('discover-no-results').style.display='none';
    resultsList.style.display = 'block';
  }

  var listItem = document.createElement('li');
  listItem.textContent = 'Found ' + displayableResults.length + ' results.';
  resultsList.appendChild(listItem);

  // TODO: displayableResults is an array, right? Why am I using forEach.call?
  // Just use displayableResults.forEach ...?

  Array.prototype.forEach.call(displayableResults, function(result) {
    var item = document.createElement('li');
    resultsList.appendChild(item);

    var button = document.createElement('button');
    button.value = result.url;
    button.title = result.url;
    button.textContent = 'Subscribe';
    button.onclick = discoverSubscribeClick;
    item.appendChild(button);

    var image = document.createElement('img');
    image.setAttribute('src', lucu.favicon.getURL(result.url));
    image.title = result.link;
    item.appendChild(image);

    var a = document.createElement('a');
    a.setAttribute('href', result.link);
    a.setAttribute('target', '_blank');
    a.title = lucu.string.stripTags(result.title);
    a.innerHTML = lucu.string.truncate(result.title, 70);
    item.appendChild(a);

    // The snippet contains HTML, not text. It does this because
    // Google provides pre-emphasized text that corresponds to the
    // query. So we want to get rid of only certain tags, not all
    // tags.

    // TODO: truncate parameter should probably instead be a parameter
    // to the query-google-feeds lib, in order to reduce caller responsibility

    var snippetSpan = document.createElement('span');
    snippetSpan.innerHTML = lucu.string.truncate(result.contentSnippet, 400);
    item.appendChild(snippetSpan);

    var span = document.createElement('span');
    span.setAttribute('class','discover-search-result-url');
    span.textContent = result.url;
    item.appendChild(span);
  });
}

function onDiscoverFeedsError(errorMessage) {
  'use strict';
  document.getElementById('discover-in-progress').style.display='none';
  console.debug('discover feeds error %o',errorMessage);
  showErrorMessage('An error occurred when searching for feeds. Details: ' + errorMessage);
}

function onUnsubscribeButtonClicked(event) {
  'use strict';
  var feedId = parseInt(event.target.value);
  var $ = document.getElementById;
  var sectionMenu = $('mi-subscriptions');

  function onUnsubscribeError(event) {
    // TODO: show an error?
    console.dir(event);
    optionsShowSection(sectionMenu);
  }

  function onUnsubscribeSuccess(event) {
    console.dir(event);
    // TODO: send out a message notifying other views
    // of the unsubscribe. That way the slides view can
    // remove any articles

    var item = document.querySelector('feedlist li[feed="'+message.feed+'"]')
    if(item) {
      item.removeEventListener('click', onFeedListItemClick);
      item.remove();
    }

    optionsUpdateFeedCount();

    if($('feedlist').childElementCount == 0) {
      $('feedlist').style.display = 'none';
      $('nosubscriptions').style.display = 'block';
    }

    // Update the badge in case any unread articles belonged to 
    // the unsubscribed feed
    lucu.badge.update();

    // Update the options view
    optionsShowSection(sectionMenu);
  }

  lucu.subscription.unsubscribe(feedId, onUnsubscribeSuccess, onUnsubscribeSuccess);
}

function onEnableURLRewritingChange(event) {
  'use strict';
  if(event.target.checked)
    localStorage.URL_REWRITING_ENABLED = '1';
  else
    delete localStorage.URL_REWRITING_ENABLED;
}

// TODO: onFeedsImported needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error parsing the OPML
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.
// TODO: notify the user
// TODO: switch to a section on complete?
function onImportOPMLClick(event) {
  'use strict';
  var uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';

  function onImport(imported, attempted, exceptions) {
    uploader.remove();

    if(exceptions && exceptions.length) {
      console.debug('Encountered exceptions when importing: %o', exceptions);
    }

    console.info('Completed import');
  }

  uploader.onchange = function onChange(event) {
    uploader.removeEventListener('change', onChange);

    if(!uploader.files || !uploader.files.length) {
      return onImport(0,0,[]);
    }

    lucu.opml.importFiles(uploader.files, onImport);
  };

  document.body.appendChild(uploader);
  uploader.click();
}


function onExportOPMLClick(event) {
  'use strict';
  lucu.opml.exportBlob(exportOPMLOnComplete);
}

function exportOPMLOnComplete(blob) {
  'use strict';
  var anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.setAttribute('download', 'subscriptions.xml');
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  // Trigger the download
  anchor.click();
  // Cleanup
  URL.revokeObjectURL(blob);
  document.body.removeChild(anchor); 
}

function onHeaderFontChange(event){
  'use strict';
  if(event.target.value)
    localStorage.HEADER_FONT_FAMILY = event.target.value;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onHeaderFontSizeChange(event) {
  'use strict';
  localStorage.HEADER_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyFontChange(event) {
  'use strict';
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onColumnCountChange(event) {
  'use strict';
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyFontSizeChange(event) {
  'use strict';
  localStorage.BODY_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyLineHeightChange(event) {
  'use strict';
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onEntryMarginChange(event) {
  'use strict';
  localStorage.ENTRY_MARGIN = parseInt(event.target.value) || 10;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBackgroundImageChange(event) {
  'use strict';
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onJustifyChange(event) {
  'use strict';
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onEnableNotificationsChange(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['notifications']}, function(granted) {});
  else
    chrome.permissions.remove({permissions:['notifications']}, function(removed) {});
}

function onEnableBackgroundChange(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['background']}, function(granted) {});
  else
    chrome.permissions.remove({permissions:['background']}, function(removed) {});
}

function onEnableIdleCheckChange(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['idle']}, function(granted){});
  else
    chrome.permissions.remove({permissions:['idle']}, function(removed){});
}

function initNavigation() {
  'use strict';
  var menuItem = document.getElementById('mi-embeds');
  menuItem.style.display = localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';

  var menuItems = document.querySelectorAll('#navigation-menu li');
  var forEach = Array.prototype.forEach;
  forEach.call(menuItems, setNavigationOnClick);
}

function setNavigationOnClick(menuItem) {
  'use strict';
  menuItem.onclick = onNavigationClick;
}

function onNavigationClick(event) {
  'use strict';
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  optionsShowSection(event.currentTarget);
}

function initGeneralSettingsSection() {
  'use strict';
  document.getElementById('enable-notifications').onclick =
    onEnableNotificationsChange;

  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    document.getElementById('enable-notifications').checked = permitted;
  });

  document.getElementById('enable-background').onclick = onEnableBackgroundChange;

  chrome.permissions.contains({permissions:['background']}, function(permitted) {
    document.getElementById('enable-background').checked = permitted;
  });

  document.getElementById('enable-idle-check').onclick = onEnableIdleCheckChange;

  chrome.permissions.contains({permissions:['idle']}, function(permitted) {
    document.getElementById('enable-idle-check').checked = permitted;
  });

  document.getElementById('enable-subscription-preview').checked =
    !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;

  document.getElementById('enable-subscription-preview').onchange =
    onEnableSubscriptionPreviewChange;

  document.getElementById('rewriting-enable').checked = !!localStorage.URL_REWRITING_ENABLED;
  document.getElementById('rewriting-enable').onchange = onEnableURLRewritingChange;
}

function initSubscriptionsSection() {
  'use strict';
  // TODO: inline and simplify this
  function forEachFeed(db, handleFeed, onComplete, sortByTitle) {
    var tx = db.transaction('feed');
    tx.oncomplete = onComplete;
    var store = tx.objectStore('feed');
    if(sortByTitle) store = store.index('title');
    store.openCursor().onsuccess = function() {
      var cursor = this.result;
      if(!cursor) return;
      handleFeed(cursor.value);
      cursor.continue();
    };
  }

  document.getElementById('button-export-opml').onclick = onExportOPMLClick;
  document.getElementById('button-import-opml').onclick = onImportOPMLClick;

  var feedCount = 0;

  // todo: react to onerror/onblocked
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    forEachFeed(db, function(feed) {
      feedCount++;
      optionsAppendFeed(feed);
      optionsUpdateFeedCount();
    }, function() {
      if(feedCount == 0) {
        document.getElementById('nosubscriptions').style.display = 'block';
        document.getElementById('feedlist').style.display = 'none';
      } else {
        document.getElementById('nosubscriptions').style.display = 'none';
        document.getElementById('feedlist').style.display = 'block';
      }
    }, true);
  };
}

function initFeedDetailsSection() {
  'use strict';
  var unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = onUnsubscribeButtonClicked;
}

function initSubscribeDiscoverSection() {
  'use strict';
  document.getElementById('subscription-form').onsubmit = onSubscribeSubmit;

  var previewContinueButton = document.getElementById('subscription-preview-continue');
  previewContinueButton.onclick = onPostPreviewSubscribeClick;
}

function initDisplaySettingsSection() {
  'use strict';
  // Apply the dynamic CSS on load to set the article preview
  // area within the display settings section
  lucu.style.onLoad();


  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  document.getElementById('entry-background-image').appendChild(option);

  lucu.BACKGROUND_IMAGES.forEach(function(path) {
    option = document.createElement('option');
    option.value = path;

    option.textContent = path.substring('/media/'.length);
    //option.textContent = path;

    option.selected = localStorage.BACKGROUND_IMAGE == path;
    document.getElementById('entry-background-image').appendChild(option);
  });

  document.getElementById('entry-background-image').onchange = onBackgroundImageChange;

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_body_font').appendChild(option);

  lucu.FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  });

  lucu.FONT_FAMILIES.forEach(function (fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_body_font').appendChild(option);
  });


  document.getElementById('select_header_font').onchange = onHeaderFontChange;
  document.getElementById('select_body_font').onchange = onBodyFontChange;


  [1,2,3].forEach(function (columnCount) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount == localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    document.getElementById('column-count').appendChild(option);
  });

  document.getElementById('column-count').onchange = onColumnCountChange;



  var inputChangedTimer, inputChangedDelay = 400;

  document.getElementById('entry-background-color').value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  document.getElementById('entry-background-color').oninput = function() {
    if(event.target.value)
      localStorage.ENTRY_BACKGROUND_COLOR = event.target.value;
    else
      delete localStorage.ENTRY_BACKGROUND_COLOR;
    chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
  };

  document.getElementById('entry-margin').value = parseInt(localStorage.ENTRY_MARGIN) || '10';
  document.getElementById('entry-margin').onchange = onEntryMarginChange;

  document.getElementById('header-font-size').value = parseInt(localStorage.HEADER_FONT_SIZE) || '1';
  document.getElementById('header-font-size').onchange = onHeaderFontSizeChange;
  document.getElementById('body-font-size').value = parseInt(localStorage.BODY_FONT_SIZE) || '1';
  document.getElementById('body-font-size').onchange = onBodyFontSizeChange;
  document.getElementById('justify-text').checked = (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  document.getElementById('justify-text').onchange = onJustifyChange;

  var bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  document.getElementById('body-line-height').value = (bodyLineHeight / 10).toFixed(2);
  document.getElementById('body-line-height').oninput = onBodyLineHeightChange;
}

function initAboutSection() {
  'use strict';
  var manifest = chrome.runtime.getManifest();

  var label = document.getElementById('extension-name');
  label.textContent = manifest.name || '';
  label = document.getElementById('extension-version');
  label.textContent = manifest.version || '';
  label = document.getElementById('extension-author');
  label.textContent = manifest.author || '';
  label = document.getElementById('extension-description');
  label.textContent = manifest.description || '';
  label = document.getElementById('extension-homepage');
  label.textContent = manifest.homepage_url || '';
}

function initOptionsPage(event) {
  'use strict';
  document.removeEventListener('DOMContentLoaded', initOptionsPage);

  initNavigation();

  // Show the default section immediately
  optionsShowSection(document.getElementById('mi-subscriptions'));

  initGeneralSettingsSection();
  initSubscriptionsSection();
  initFeedDetailsSection();
  initSubscribeDiscoverSection();
  initDisplaySettingsSection();
  initAboutSection();
}

document.addEventListener('DOMContentLoaded', initOptionsPage);
