// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function onOptionsPageMessage(message) {
  if('displaySettingsChanged' == message.type) {
    lucu.style.onChange();
  } else if('pollCompleted' == message.type) {
    // noop
  } else if('subscribe' == message.type) {
    optionsAppendFeed(message.feed, true);
    optionsUpdateFeedCount();
  } else if('unsubscribe' == message.type) {

    var item = document.querySelector('feedlist li[feed="'+message.feed+'"]')
    if(item) {
      item.removeEventListener('click', onFeedListItemClick);
      item.remove();
    }

    if(document.getElementById('feedlist').childElementCount == 0) {
      document.getElementById('feedlist').style.display = 'none';
      document.getElementById('nosubscriptions').style.display = 'block';
    }

    optionsUpdateFeedCount();
    optionsShowSection(document.getElementById('mi-subscriptions'));
  } else if('entryRead' == message.type) {

    // If we ever start showing unread counts per feed
    // this would need to update the unread count

  } else {
    console.warn('Unknown message type %s', message.type);
  }
}

chrome.runtime.onMessage.addListener(onOptionsPageMessage);

function hideErrorMessage() {
  var container = document.getElementById('options_error_message');
  if(!container) return;
  var dismissButton = document.getElementById('options_dismiss_error_button');
  if(dismissButton)
    dismissButton.removeEventListener('click', hideErrorMessage);
  container.remove();
}


function showErrorMessage(message, fadeIn) {
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
  var subMonitor = document.getElementById('options_subscription_monitor');
  return subMonitor && subMonitor.style.display == 'block';
}

function resetSubscriptionMonitor() {
  var element = document.getElementById('options_subscription_monitor');
  element && element.remove();
}

function updateSubscriptionMonitor(message) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) return;
  var paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}

function hideSubsciptionMonitor(onComplete, fadeOut) {
  var container = document.getElementById('options_subscription_monitor');

  // NOTE: possible bug here, should be checking arguments.length
  onComplete = onComplete || lucu.functionUtils.noop;

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
  var item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed',feed.id);
  item.setAttribute('title', lucu.string.stripTags(feed.description) || '');
  item.onclick = onFeedListItemClick;
  var favIconElement = document.createElement('img');
  favIconElement.src = lucu.favIcon.getURL(feed.link);
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
  if(this.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
}


function showOrSkipSubscriptionPreview(url) {

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

  var onFetchSuccess = function(result) {
    // Stop the indeterminate progress bar.
    document.getElementById('subscription-preview-load-progress').style.display = 'none';

    // Show the title
    //document.getElementById('subscription-preview-title').style.display = 'block';
    document.getElementById('subscription-preview-title').textContent = result.title || 'Untitled';

    // Update the value of the continue button so its click handler
    // can get the vvalue for subscription
    document.getElementById('subscription-preview-continue').value = result.url;

    // result.title and  result.entries
    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No entries found to preview';
      document.getElementById('subscription-preview-entries').appendChild(item);
    }

    // Show up to 5 (inclusive) entries.
    for(var i = 0, len = Math.min(5,result.entries.length); i < len;i++) {
      var entry = result.entries[i];
      var item = document.createElement('li');
      item.innerHTML = lucu.string.stripTags(entry.title);
      var content = document.createElement('span');
      content.innerHTML = lucu.string.stripTags(entry.content);
      item.appendChild(content);
      document.getElementById('subscription-preview-entries').appendChild(item);
    }
  };

  // TODO: check if already subscribed before preview?

  lucu.feed.fetch({
    url: url,
    oncomplete: onFetchSuccess,
    onerror: onerror,
    timeout: timeout,
    entryTimeout: 0,
    augmentEntries: false,
    augmentImageData: false,
    rewriteLinks: false
  });
}

function hideSubscriptionPreview() {
  document.getElementById('subscription-preview').style.display = 'none';
  document.getElementById('subscription-preview-entries').innerHTML = '';
}

function startSubscription(url) {

  // Done with preview, ensure it is hidden.
  hideSubscriptionPreview();

  if(!lucu.uri.isValid(url)) {
    return showErrorMessage('Invalid url "' + url + '".');
  }

  showSubscriptionMonitor();
  updateSubscriptionMonitor('Subscribing...');

  lucu.database.open(function(db) {
    lucu.feed.findBySchemelessURL(db, url, function(existingFeed) {

      if(existingFeed) {
        return hideSubsciptionMonitor(function() {
          showErrorMessage('You are already subscribed to "' + url + '".');
        });
      }

      if(!navigator.onLine) {
        // Subscribe while offline
        return lucu.feed.add(db, {url: url}, onSubscriptionSuccessful, console.debug);
      }

      lucu.feed.fetch({
        url: url,
        oncomplete: onFetchComplete,
        onerror: onFetchError,
        timeout: 10 * 1000,
        entryTimeout: 20 * 1000,
        augmentEntries: true,
        augmentImageData: true,
        rewriteLinks: true
      });
    });
  });

  function onFetchComplete(remoteFeed) {
    remoteFeed.url = url;
    remoteFeed.fetched = Date.now();

    lucu.database.open(function(db) {
      lucu.feed.add(db, remoteFeed, onSubscriptionSuccessful, console.debug);
    });
  }

  function onFetchError(error) {
    console.debug('fetch error %o', error);
    hideSubsciptionMonitor(function() {
      showErrorMessage('An error occurred while trying to subscribe to ' + url);
    });
  }

  function onSubscriptionSuccessful(addedFeed, entriesProcessed, entriesAdded) {
    updateSubscriptionMonitor('Subscribed to ' + url);
    hideSubsciptionMonitor(function() {
      optionsShowSection(document.getElementById('mi-subscriptions'));
    }, true);

    chrome.runtime.sendMessage({
      type: 'subscribe',
      feed: addedFeed,
      entriesProcessed: entriesProcessed || 0,
      entriesAdded: entriesAdded || 0
    });
  }
}

function populateFeedDetailsSection(feedId) {
  lucu.database.open(function(db) {
    db.transaction('feed').objectStore('feed').get(feedId).onsuccess = function(event) {
      var feed = event.target.result;
      document.getElementById('details-title').textContent = feed.title || 'Untitled';
      document.getElementById('details-favicon').setAttribute('src',
        lucu.favIcon.getURL(feed.url));
      document.getElementById('details-feed-description').textContent =
        lucu.string.stripTags(feed.description) || 'No description';
      document.getElementById('details-feed-url').textContent = feed.url;
      document.getElementById('details-feed-link').textContent = feed.link;
      document.getElementById('details-unsubscribe').value = feed.id;
    };
  });
}

function appendContentFilterRule(listElement, rule) {
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = contentFiltering.ruleToString(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  button.onclick = onRemoveContentFilterClick;
  listItem.appendChild(button);
  listElement.appendChild(listItem);
}

function onPostPreviewSubscribeClick(event) {
  var url = event.currentTarget.value;
  hideSubscriptionPreview();
  startSubscription(url);
}

function onFeedListItemClick(event) {
  var feedId = parseInt(event.currentTarget.getAttribute('feed'));
  populateFeedDetailsSection(feedId);

  // TODO: These calls should really be in an async callback
  // passed to populateFeedDetailsSection
  optionsShowSection(document.getElementById('mi-feed-details'));
  window.scrollTo(0,0);
}


function onSubscribeSubmit(event) {
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


  if(lucu.uri.isValid(query)) {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
     document.getElementById('discover-in-progress').style.display='none';
    document.getElementById('subscribe-discover-query').value = '';
    showOrSkipSubscriptionPreview(query);
  } else {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
    document.getElementById('discover-in-progress').style.display='block';

    lucu.feed.discover(query, onDiscoverFeedsComplete, onDiscoverFeedsError,
      5000);

  }
  return false;
}


function discoverSubscribeClick(event) {
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
  var resultsList = document.getElementById('discover-results-list');
  document.getElementById('discover-in-progress').style.display='none';

  // Need to filter as for some reason the discover feeds
  // service sometimes returns results that do not have a url
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
    image.setAttribute('src', lucu.favIcon.getURL(result.url));
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
    var snippetSpan = document.createElement('span');
    snippetSpan.innerHTML = lucu.string.truncate(lucu.string.stripBRs(result.contentSnippet), 400);
    item.appendChild(snippetSpan);

    var span = document.createElement('span');
    span.setAttribute('class','discover-search-result-url');
    span.textContent = result.url;
    item.appendChild(span);
  });
}

function onDiscoverFeedsError(errorMessage) {
  document.getElementById('discover-in-progress').style.display='none';
  console.debug('discover feeds error %o',errorMessage);
  showErrorMessage('An error occurred when searching for feeds. Details: ' + errorMessage);
}

function onUnsubscribeButtonClicked(event) {
  var feedId = parseInt(event.target.value);
  lucu.database.open(function(db) {
    lucu.feed.removeById(db, feedId, function() {
      console.info('Unsubscribed from %s', feedId);
      optionsShowSection(document.getElementById('mi-subscriptions'));
    });
  });
}

function onEnableURLRewritingChange(event) {
  if(event.target.checked)
    localStorage.URL_REWRITING_ENABLED = '1';
  else
    delete localStorage.URL_REWRITING_ENABLED;
}

function onEnableContentFiltersChange(event) {
  if(event.target.checked) {
    localStorage.ENABLE_CONTENT_FILTERS = '1';
    document.getElementById('mi-content-filters').style.display = 'block';
  } else {
    delete localStorage.ENABLE_CONTENT_FILTERS;
    document.getElementById('mi-content-filters').style.display = 'none';
  }
}

function onImportOPMLClick(event) {
  var uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display='none';
  uploader.onchange = onFileInputChanged;
  document.body.appendChild(uploader);
  uploader.click();
}

// TODO: can onFileInputChanged remove the input element
// or do we need to wait until the file was read in the callback?
function onFileInputChanged(event) {

  // TODO: catch numerical error codes in onFileReaderLoad
  // instead of English sentence strings?

  if(!event.target.files || !event.target.files.length) return;
  // TODO: start import progress monitor

  // TODO: move the nested function out of here
  lucu.backup.importOPMLFiles(event.target.files,
    function(feedsImported, totalFeedsAttempted, exceptions) {
      event.target.removeEventListener('change', onFileInputChanged);
      document.body.removeChild(event.target);
      onFeedsImported(feedsImported, totalFeedsAttempted, exceptions);
  });
}

// TODO: onFeedsImported needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error parsing the OPML
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.
function onFeedsImported(feedsImported, totalFeedsAttempted, exceptions) {
  if(exceptions && exceptions.length) {
    console.debug('Encountered exceptions when importing: %o', exceptions);
  }

  // TODO: stop the import progress monitor
  // TODO: notify the user
  // switch to section
  console.info('Completed import of feeds');
}

function onExportOPMLClick(event) {

  // TODO: move the nested function out of here

  lucu.backup.exportOPMLString(function(xmlString) {
    var blob = new Blob([xmlString], {type:'application/xml'});
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.setAttribute('download', 'subscriptions.xml');
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    URL.revokeObjectURL(blob);
    document.body.removeChild(anchor);
  });
}

function onCreateContentFilterClick(event) {
  var rule = contentFiltering.createRule(
    document.getElementById('create-filter-tag-name').value,
    document.getElementById('create-filter-attribute-name').value,
    document.getElementById('create-filter-attribute-value-match').value);

  document.getElementById('create-filter-tag-name').value = '';
  document.getElementById('create-filter-attribute-name').value = '';
  document.getElementById('create-filter-attribute-value-match').value = '';

  appendContentFilterRule(document.getElementById('content-filters-list'), rule);
}

function onRemoveContentFilterClick(event) {
  event.target.removeEventListener('click', onRemoveContentFilterClick);
  contentFiltering.removeRule(parseInt(event.target.value));
  event.currentTarget.parentNode.removeChild(event.currentTarget);
}

function onHeaderFontChange(event){
  if(event.target.value)
    localStorage.HEADER_FONT_FAMILY = event.target.value;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onHeaderFontSizeChange(event) {
  localStorage.HEADER_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyFontChange(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyFontSizeChange(event) {
  localStorage.BODY_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyLineHeightChange(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onEntryMarginChange(event) {
  localStorage.ENTRY_MARGIN = parseInt(event.target.value) || 10;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBackgroundImageChange(event) {
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onJustifyChange(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onEnableNotificationsChange(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['notifications']}, function(granted) {});
  else
    chrome.permissions.remove({permissions:['notifications']}, function(removed) {});
}

function onEnableBackgroundChange(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['background']}, function(granted) {});
  else
    chrome.permissions.remove({permissions:['background']}, function(removed) {});
}

function onEnableIdleCheckChange(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['idle']}, function(granted){});
  else
    chrome.permissions.remove({permissions:['idle']}, function(removed){});
}

function initNavigation() {
  var menuItem = document.getElementById('mi-content-filters');
  menuItem.style.display = localStorage.ENABLE_CONTENT_FILTERS ? 'block' : 'none';

  menuItem = document.getElementById('mi-embeds');
  menuItem.style.display = localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';

  var menuItems = document.querySelectorAll('#navigation-menu li');
  lucu.element.forEach(menuItems, setNavigationOnClick);
}

function setNavigationOnClick(menuItem) {
  menuItem.onclick = onNavigationClick;
}

function onNavigationClick(event) {
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  optionsShowSection(event.currentTarget);
}


function initGeneralSettingsSection() {

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

  document.getElementById('enable-content-filters').checked = !!localStorage.ENABLE_CONTENT_FILTERS;
  document.getElementById('enable-content-filters').onchange = onEnableContentFiltersChange;
  document.getElementById('rewriting-enable').checked = !!localStorage.URL_REWRITING_ENABLED;
  document.getElementById('rewriting-enable').onchange = onEnableURLRewritingChange;
}

function initSubscriptionsSection() {

  document.getElementById('button-export-opml').onclick = onExportOPMLClick;
  document.getElementById('button-import-opml').onclick = onImportOPMLClick;

  var feedCount = 0;
  lucu.database.open(function(db) {

    lucu.feed.forEach(db, function(feed) {
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
  });
}

function initFeedDetailsSection() {
  var unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = onUnsubscribeButtonClicked;
}

function initSubscribeDiscoverSection() {
  document.getElementById('subscription-form').onsubmit = onSubscribeSubmit;

  var previewContinueButton = document.getElementById('subscription-preview-continue');
  previewContinueButton.onclick = onPostPreviewSubscribeClick;
}

function initDisplaySettingsSection() {

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

  lucu.FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_body_font').appendChild(option);
  });

  document.getElementById('select_header_font').onchange = onHeaderFontChange;
  document.getElementById('select_body_font').onchange = onBodyFontChange;

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

function initContentFiltersSection() {

  var createButton = document.getElementById('create-filter-action');
  createButton.onclick = onCreateContentFilterClick;

  var listElement = document.getElementById('content-filters-list');
  // TODO: change this to use the new ContentFilterList module
  //var rules = loadContentFilterRules();
  //var appendRuleToList = appendContentFilterRule.bind(null, listElement);
  //rules.forEach(appendRuleToList);
}

function initAboutSection() {
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
  document.removeEventListener('DOMContentLoaded', initOptionsPage);

  initNavigation();

  // Show the default section immediately
  optionsShowSection(document.getElementById('mi-subscriptions'));

  initGeneralSettingsSection();
  initSubscriptionsSection();
  initFeedDetailsSection();
  initSubscribeDiscoverSection();
  initDisplaySettingsSection();
  initContentFiltersSection();
  initAboutSection();
}

document.addEventListener('DOMContentLoaded', initOptionsPage);
