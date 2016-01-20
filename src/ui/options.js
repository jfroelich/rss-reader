// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function $$(name) {
  return document.getElementById(name);
}

function hideErrorMessage() {
  const container = $$('options_error_message');
  if(!container) return;
  const dismissButton = $$('options_dismiss_error_button');
  if(dismissButton)
    dismissButton.removeEventListener('click', hideErrorMessage);
  container.remove();
}

function showErrorMessage(message, fadeIn) {
  hideErrorMessage();
  const elMessage = document.createElement('span');
  elMessage.textContent = message;
  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id','options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = hideErrorMessage;
  const container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.appendChild(elMessage);
  container.appendChild(dismissButton);
  if(fadeIn) {
    container.style.opacity = '0';
    document.body.appendChild(container);
    fadeElement(container, 1, 0);
  } else {
    container.style.display = '';
    container.style.opacity = '1';
    document.body.appendChild(container);
  }
}

// TODO: instead of removing and re-adding, reset and reuse
function showSubscriptionMonitor() {
  resetSubscriptionMonitor();
  const container = document.createElement('div');
  container.setAttribute('id', 'options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);
  const progress = document.createElement('progress');
  progress.textContent = 'working...';
  container.appendChild(progress);
}

function resetSubscriptionMonitor() {
  const element = $$('options_subscription_monitor');
  element && element.remove();
}

function updateSubscriptionMonitor(message) {
  const container = $$('options_subscription_monitor');
  if(!container) return;
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}

function hideSubsciptionMonitor(onComplete, fadeOut) {
  const container = $$('options_subscription_monitor');
  // NOTE: possible bug here, should be checking arguments.length
  const noop = function(){};
  onComplete = onComplete || noop;

  if(!container) {
    return onComplete();
  }

  if(fadeOut) {
    fadeElement(container, 2, 1, removeAndComplete);
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

function showSection(menuItem) {
  if(!menuItem || currentMenuItem_ == menuItem) {
    return;
  }

  menuItem.classList.add('navigation-item-selected');
  if(currentMenuItem_)
    currentMenuItem_.classList.remove('navigation-item-selected');
  if(currentSection_)
    currentSection_.style.display = 'none';

  const section = $$(menuItem.getAttribute('section'));

  if(section) {
    section.style.display = 'block';
  } else {
  }
  currentMenuItem_ = menuItem;
  currentSection_ = section;
}

function updateFeedCount() {
  const count = $$('feedlist').childElementCount;
  const countElement = $$('subscription-count');
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

function appendFeed(feed, insertedSort) {
  if(!feed) {
    console.error('feed undefined in appendFeed');
    return;
  }

  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);
  item.setAttribute('title', replaceHTML(feed.description) || '');
  item.onclick = onFeedListItemClick;
  var favIconElement = document.createElement('img');
  favIconElement.src = getFaviconURL(feed.link);
  if(feed.title) favIconElement.title = feed.title;
  item.appendChild(favIconElement);

  const title = document.createElement('span');
  title.textContent = truncateString(feed.title,300) || 'Untitled';
  item.appendChild(title);

  const feedListElement = $$('feedlist');

  if(insertedSort) {
    const currentItems = feedListElement.childNodes;
    var added = false;

    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
      if(indexedDB.cmp(feed.title || '', currentKey || '') === -1) {
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
  hideSubscriptionPreview();
  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    startSubscription(url);
    return;
  }

  if(!navigator.onLine) {
    startSubscription(url);
    return;
  }

  $$('subscription-preview').style.display = 'block';
  $$('subscription-preview-load-progress').style.display = 'block';
  const timeout = 10 * 1000;
  // TODO: check if already subscribed before preview?
  fetchFeed(url, timeout, onFetch);

  function onFetch(event, result) {
    if(event) {
      console.dir(event);
      hideSubscriptionPreview();
      showErrorMessage('Unable to fetch' + url);
      return;
    }

    $$('subscription-preview-load-progress').style.display = 'none';
    //$$('subscription-preview-title').style.display = 'block';
    $$('subscription-preview-title').textContent =
      result.title || 'Untitled';
    $$('subscription-preview-continue').value = result.url;
    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No previewable entries';
      $$('subscription-preview-entries').appendChild(item);
    }

    for(var i = 0, len = Math.min(5,result.entries.length); i < len;i++) {
      var entry = result.entries[i];
      var item = document.createElement('li');
      item.innerHTML = replaceHTML(entry.title);
      var content = document.createElement('span');
      content.innerHTML = replaceHTML(entry.content);
      item.appendChild(content);
      $$('subscription-preview-entries').appendChild(item);
    }
  }
}

function hideSubscriptionPreview() {
  $$('subscription-preview').style.display = 'none';
  $$('subscription-preview-entries').innerHTML = '';
}

function startSubscription(url) {
  hideSubscriptionPreview();

  if(!URLUtils.isValid(url)) {
    showErrorMessage('Invalid url "' + url + '".');
    return;
  }

  showSubscriptionMonitor();
  updateSubscriptionMonitor('Subscribing...');

  openIndexedDB(function(event) {
    if(event.type !== 'success') {
      console.debug(event);
      hideSubsciptionMonitor(function() {
        showErrorMessage(
          'An error occurred while trying to subscribe to ' + url);
      });
      return;
    }

    const connection = event.target.result;

    FeedStore.findByURL(connection, url,
      onFindByURL.bind(null, connection));
  });

  function onFindByURL(connection, event) {
    if(event.target.result) {
      hideSubsciptionMonitor(function() {
        showErrorMessage('Already subscribed to ' + url + '.');
      });
      return;
    }

    if(!window.navigator.onLine) {
      FeedStore.put(connection, null, {url: url}, onSubscribe);
    } else {
      fetchFeed(url, 10 * 1000, onFetch.bind(null, connection));
    }
  }

  function onFetch(connection, event, remoteFeed) {
    if(event) {
      console.dir(event);
      hideSubsciptionMonitor(function() {
        showErrorMessage('An error occurred while trying to subscribe to ' + url);
      });
      return;
    }

    FeedStore.put(connection, null, remoteFeed, function() {
      onSubscribe(remoteFeed, 0, 0);
    });
  }

  function onSubscribe(addedFeed, entriesProcessed, entriesAdded) {
    appendFeed(addedFeed, true);
    updateFeedCount();
    updateSubscriptionMonitor('Subscribed to ' + url);
    hideSubsciptionMonitor(function() {
      showSection($$('mi-subscriptions'));
    }, true);

    // Show a notification
    var title = addedFeed.title || addedFeed.url;
    showNotification('Subscribed to ' + title);
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: react to connection error, find error
function populateFeedDetailsSection(feedId) {
  openIndexedDB(function(event) {
    if(event.type !== 'success') {
      return;
    }

    FeedStore.findById(event.target.result, feedId, function(event) {
      const feed = event.target.result;
      if(!feed) {
        return;
      }

      $$('details-title').textContent = feed.title || 'Untitled';
      $$('details-favicon').setAttribute('src', getFaviconURL(feed.url));
      $$('details-feed-description').textContent =
        replaceHTML(feed.description) || 'No description';
      $$('details-feed-url').textContent = feed.url;
      $$('details-feed-link').textContent = feed.link;
      $$('details-unsubscribe').value = feed.id;
    });
  });
}

function onFeedListItemClick(event) {
  const feedId = parseInt(event.currentTarget.getAttribute('feed'));
  populateFeedDetailsSection(feedId);
  // TODO: These calls should really be in an async callback
  // passed to populateFeedDetailsSection
  showSection($$('mi-feed-details'));
  window.scrollTo(0,0);
}

function onSubscribeSubmit(event) {

  event.preventDefault();// Prevent normal form submission event

  var query = $$('subscribe-discover-query').value;
  query = query || '';
  query = query.trim();
  if(!query) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  if($$('discover-in-progress').style.display == 'block') {
    return false;
  }

  const subMonitor = $$('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    return false;
  }

  if(isValidURL(query)) {
    $$('discover-results-list').innerHTML = '';
    $$('discover-no-results').style.display = 'none';
    $$('discover-in-progress').style.display = 'none';
    $$('subscribe-discover-query').value = '';
    showOrSkipSubscriptionPreview(query);
  } else {
    $$('discover-results-list').innerHTML = '';
    $$('discover-no-results').style.display = 'none';
    $$('discover-in-progress').style.display = 'block';
    searchGoogleFeeds(query, 5000, onDiscoverFeedsComplete);
  }

  return false;
}

function discoverSubscribeClick(event) {
  const button = event.target;
  const url = button.value;
  if(!url)
    return;
  // TODO: Ignore future clicks if error was displayed?
  // Ignore future clicks while subscription in progress
  const subMonitor = $$('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block')
    return;
  showOrSkipSubscriptionPreview(url);
}

function onDiscoverFeedsComplete(errorEvent, query, results) {

  if(!query || !results) {
    if(!errorEvent) {
      errorEvent = 'No results';
    }
  }

  if(errorEvent) {
    $$('discover-in-progress').style.display = 'none';
    console.debug('discover feeds error %o', errorEvent);
    showErrorMessage('An error occurred when searching for feeds. Details: ' +
      errorEvent);
    return;
  }

  const resultsList = $$('discover-results-list');
  $$('discover-in-progress').style.display = 'none';
  if(results.length < 1) {
    resultsList.style.display = 'none';
    $$('discover-no-results').style.display = 'block';
    return;
  }
  if(resultsList.style.display === 'block') {
    resultsList.innerHTML = '';
  } else {
    $$('discover-no-results').style.display = 'none';
    resultsList.style.display = 'block';
  }

  const listItem = document.createElement('li');
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);
  results.forEach(function(result) {
    const item = document.createElement('li');
    resultsList.appendChild(item);
    const button = document.createElement('button');
    button.value = result.url;
    button.title = result.url;
    button.textContent = 'Subscribe';
    button.onclick = discoverSubscribeClick;
    item.appendChild(button);
    const image = document.createElement('img');
    image.setAttribute('src', getFaviconURL(result.url));
    image.title = result.link;
    item.appendChild(image);
    const a = document.createElement('a');
    a.setAttribute('href', result.link);
    a.setAttribute('target', '_blank');
    a.title = result.title;
    a.innerHTML = result.title;
    item.appendChild(a);
    const snippetSpan = document.createElement('span');
    snippetSpan.innerHTML = result.contentSnippet;
    item.appendChild(snippetSpan);
    const span = document.createElement('span');
    span.setAttribute('class','discover-search-result-url');
    span.textContent = result.url;
    item.appendChild(span);
  });
}

function onUnsubscribeButtonClicked(event) {
  const buttonValue = event.target.value;
  const feedId = parseInt(buttonValue);

  if(!feedId) {
    console.debug('Invalid feed id: %s', buttonValue);
    return;
  }

  openIndexedDB(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    FeedStore.unsubscribe(connection, feedId,
      onUnsubscribe.bind(null, connection));
  }

  function onUnsubscribe(event) {
    const sectionMenu = $$('mi-subscriptions');

    // Update the badge in case any unread articles belonged to
    // the unsubscribed feed
    updateBadge(connection);

    // TODO: send out a message notifying other views
    // of the unsubscribe. That way the slides view can
    // remove any articles.

    const item = document.querySelector('feedlist li[feed="' + feedId + '"]');
    if(item) {
      item.removeEventListener('click', onFeedListItemClick);
      item.remove();
    }

    updateFeedCount();

    if($$('feedlist').childElementCount === 0) {
      $$('feedlist').style.display = 'none';
      $$('nosubscriptions').style.display = 'block';
    }

    // Update the options view
    showSection(sectionMenu);
  }
}

function onEnableURLRewritingChange(event) {
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
// TODO: notify the user of successful import
// TODO: switch to a different section of the options ui on complete?
function onImportOPMLClick(event) {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  uploader.onchange = function onChange(event) {
    uploader.removeEventListener('change', onChange);

    if(!uploader.files || !uploader.files.length) {
      onImport();
      return;
    }

    importOPML(uploader.files, onImport);
  };

  document.body.appendChild(uploader);
  uploader.click();

  function onImport(tracker) {
    uploader.remove();

    if(!tracker) {
      console.debug('OPML import error, undefined stats tracker');
      return;
    }

    const errors = tracker.errors;

    if(errors && errors.length) {
      console.debug('Encountered exceptions when importing: %o', errors);
    }

    // TODO: showNotification because opml import no longer does this itself

    console.info('Completed opml import, imported %s of %s files',
      tracker.filesImported, tracker.numFiles);
  }
}

// todo: this should delegate its functionality to an external
// function like triggerFileDownload(hostDocument, title, contentBlob);

function onExportOPMLClick(event) {
  openIndexedDB(onExportOPMLClickOnOpenIndexedDB);
}

function onExportOPMLClickOnOpenIndexedDB(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    getAllFeeds(connection, onExportOPMLClickOnGetAllFeeds);
  } else {
    // TODO: visually report the error
    console.debug('Failed to connect to database when exporting opml');
  }
}

function onExportOPMLClickOnGetAllFeeds(feeds) {
  const title = 'Subscriptions';
  const doc = createOPMLDocument(title, feeds);
  const writer = new XMLSerializer();
  const serializedString = writer.serializeToString(doc);
  const blobFormat = {type: 'application/xml'};
  const blob = new Blob([serializedString], blobFormat);
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  const fileName = 'subscriptions.xml';
  anchor.setAttribute('download', fileName);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  URL.revokeObjectURL(objectURL);
  anchor.remove();
  console.debug('Completed exporting %s feeds to opml file %s',
    doc.querySelectorAll('outline').length, fileName);
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

function onColumnCountChange(event) {
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
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
    chrome.permissions.request({permissions:['notifications']}, function() {});
  else
    chrome.permissions.remove({permissions:['notifications']}, function() {});
}

function onEnableBackgroundChange(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['background']}, function() {});
  else
    chrome.permissions.remove({permissions:['background']}, function() {});
}

function onEnableIdleCheckChange(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['idle']}, function(){});
  else
    chrome.permissions.remove({permissions:['idle']}, function(){});
}

function initNavigation() {
  const menuItem = $$('mi-embeds');
  menuItem.style.display = localStorage.EMBED_POLICY === 'ask' ? 'block' : 'none';
  const menuItems = document.querySelectorAll('#navigation-menu li');
  Array.prototype.forEach.call(menuItems, setNavigationOnClick);
}

function setNavigationOnClick(menuItem) {
  menuItem.onclick = onNavigationClick;
}

function onNavigationClick(event) {
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  showSection(event.currentTarget);
}

function initGeneralSettingsSection() {
  $$('enable-notifications').onclick = onEnableNotificationsChange;

  chrome.permissions.contains({permissions: ['notifications']},
    function(permitted) {
    $$('enable-notifications').checked = permitted;
  });

  $$('enable-background').onclick = onEnableBackgroundChange;

  chrome.permissions.contains({permissions:['background']},
    function(permitted) {
    $$('enable-background').checked = permitted;
  });

  $$('enable-idle-check').onclick = onEnableIdleCheckChange;

  chrome.permissions.contains({permissions:['idle']}, function(permitted) {
    $$('enable-idle-check').checked = permitted;
  });

  $$('enable-subscription-preview').checked = !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  $$('enable-subscription-preview').onchange = onEnableSubscriptionPreviewChange;
  $$('rewriting-enable').checked = !!localStorage.URL_REWRITING_ENABLED;
  $$('rewriting-enable').onchange = onEnableURLRewritingChange;
}

function initSubscriptionsSection() {
  $$('button-export-opml').onclick = onExportOPMLClick;
  $$('button-import-opml').onclick = onImportOPMLClick;

  let feedCount = 0;

  openIndexedDB(function(event) {
    if(event.type !== 'success') {
      // TODO: react
      console.debug(event);
      return;
    }

    FeedStore.forEach(event.target.result, handleFeed, true, onComplete);
  });

  function handleFeed(feed) {
    feedCount++;
    appendFeed(feed);
    updateFeedCount();
  }

  function onComplete() {
    if(feedCount === 0) {
      $$('nosubscriptions').style.display = 'block';
      $$('feedlist').style.display = 'none';
    } else {
      $$('nosubscriptions').style.display = 'none';
      $$('feedlist').style.display = 'block';
    }
  }
}

function initFeedDetailsSection() {
  const unsubscribeButton = $$('details-unsubscribe');
  unsubscribeButton.onclick = onUnsubscribeButtonClicked;
}

function initSubscribeDiscoverSection() {
  $$('subscription-form').onsubmit = onSubscribeSubmit;
  $$('subscription-preview-continue').onclick = function(event) {
    const url = event.currentTarget.value;
    hideSubscriptionPreview();
    startSubscription(url);
  };
}

function initDisplaySettingsSection() {
  loadEntryStyles();
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  $$('entry-background-image').appendChild(option);

  BACKGROUND_IMAGES.forEach(function(path) {
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/media/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE == path;
    $$('entry-background-image').appendChild(option);
  });

  $$('entry-background-image').onchange = onBackgroundImageChange;

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  $$('select_header_font').appendChild(option);

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  $$('select_body_font').appendChild(option);

  FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    $$('select_header_font').appendChild(option);
  });
  FONT_FAMILIES.forEach(function (fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    $$('select_body_font').appendChild(option);
  });

  $$('select_header_font').onchange = onHeaderFontChange;
  $$('select_body_font').onchange = onBodyFontChange;

  [1,2,3].forEach(function (columnCount) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    $$('column-count').appendChild(option);
  });

  $$('column-count').onchange = onColumnCountChange;

  var inputChangedTimer, inputChangedDelay = 400;

  $$('entry-background-color').value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  $$('entry-background-color').oninput = function() {
    if(event.target.value)
      localStorage.ENTRY_BACKGROUND_COLOR = event.target.value;
    else
      delete localStorage.ENTRY_BACKGROUND_COLOR;
    chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
  };

  $$('entry-margin').value = parseInt(localStorage.ENTRY_MARGIN) || '10';
  $$('entry-margin').onchange = onEntryMarginChange;
  $$('header-font-size').value = parseInt(localStorage.HEADER_FONT_SIZE) || '1';
  $$('header-font-size').onchange = onHeaderFontSizeChange;
  $$('body-font-size').value = parseInt(localStorage.BODY_FONT_SIZE) || '1';
  $$('body-font-size').onchange = onBodyFontSizeChange;
  $$('justify-text').checked = (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  $$('justify-text').onchange = onJustifyChange;
  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  $$('body-line-height').value = (bodyLineHeight / 10).toFixed(2);
  $$('body-line-height').oninput = onBodyLineHeightChange;
}

function initAboutSection() {
  const manifest = chrome.runtime.getManifest();
  $$('extension-name').textContent = manifest.name || '';
  $$('extension-version').textContent = manifest.version || '';
  $$('extension-author').textContent = manifest.author || '';
  $$('extension-description').textContent = manifest.description || '';
  $$('extension-homepage').textContent = manifest.homepage_url || '';
}

function initOptionsPage(event) {
  document.removeEventListener('DOMContentLoaded', initOptionsPage);
  initNavigation();
  showSection($$('mi-subscriptions'));
  initGeneralSettingsSection();
  initSubscriptionsSection();
  initFeedDetailsSection();
  initSubscribeDiscoverSection();
  initDisplaySettingsSection();
  initAboutSection();
}

document.addEventListener('DOMContentLoaded', initOptionsPage);

} // END ANONYMOUS NAMESPACE
