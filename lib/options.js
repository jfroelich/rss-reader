

function onOptionsPageMessage(message) {
  if('displaySettingsChanged' == message.type) {
    applyEntryStylesOnChange();
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

    fadeElement(container, 1, 0);

  } else {
    container.style.display = '';
    container.style.opacity = '1';
    document.body.appendChild(container);
  }
};

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
    console.warn('Could not locate section for %s', menuItem);
  }
  currentMenuItem_ = menuItem;
  currentSection_ = section;
}

function setNavigationOnClick(menuItem) {
  menuItem.onclick = onNavigationClick;
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
  item.setAttribute('title', stripTags(feed.description) || '');
  item.onclick = onFeedListItemClick;
  var favIconElement = document.createElement('img');
  favIconElement.src = getFavIconURL(feed.link);
  if(feed.title) favIconElement.title = feed.title;
  item.appendChild(favIconElement);

  var title = document.createElement('span');
  title.textContent = truncate(feed.title,300) || 'Untitled';
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

  console.log('showOrSkipSubscriptionPreview %s',url);
  hideSubscriptionPreview();

  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    console.log('subscription preview not enabled, skipping preview');
    startSubscription(url);
    return;
  }

  if(!navigator.onLine) {
    console.log('cannot preview while offline, skipping preview');
    startSubscription(url);
    return;
  }

  // Show the preview area
  document.getElementById('subscription-preview').style.display = 'block';
  // Start an indeterminate progress bar.
  document.getElementById('subscription-preview-load-progress').style.display = 'block';

  // invalid url or parse error or exists
  var onerror = function(error) {
    console.log('error fetching %s for preview', error);
    console.dir(error);

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
      item.innerHTML = stripTags(entry.title);
      var content = document.createElement('span');
      content.innerHTML = stripTags(entry.content);
      item.appendChild(content);
      document.getElementById('subscription-preview-entries').appendChild(item);
    }
  };

  // TODO: check if already subscribed before preview?

  fetchFeed({
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

  if(!isValidURIString(url)) {
    return showErrorMessage('Invalid url "' + url + '".');
  }

  showSubscriptionMonitor();
  updateSubscriptionMonitor('Subscribing...');

  openIndexedDB(function(db) {
    findFeedBySchemelessURL(db, url, function(existingFeed) {

      if(existingFeed) {
        return hideSubsciptionMonitor(function() {
          showErrorMessage('You are already subscribed to "' + url + '".');
        });
      }

      if(!navigator.onLine) {
        // Subscribe while offline
        return addFeed(db, {url: url}, onSubscriptionSuccessful, console.error);
      }

      fetchFeed({
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

    openIndexedDB(function(db) {
      addFeed(db, remoteFeed, onSubscriptionSuccessful, console.error);
    });
  }

  function onFetchError(error) {
    console.dir(error);
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
  openIndexedDB(function(db) {
    db.transaction('feed').objectStore('feed').get(feedId).onsuccess = function(event) {
      var feed = event.target.result;
      document.getElementById('details-title').textContent = feed.title || 'Untitled';
      document.getElementById('details-favicon').setAttribute('src', getFavIconURL(feed.url));
      document.getElementById('details-feed-description').textContent =
        stripTags(feed.description) || 'No description';
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

function onNavigationClick(event) {

  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  optionsShowSection(event.currentTarget);
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


  if(isValidURIString(query)) {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
     document.getElementById('discover-in-progress').style.display='none';
    document.getElementById('subscribe-discover-query').value = '';
    showOrSkipSubscriptionPreview(query);
  } else {
    document.getElementById('discover-results-list').innerHTML = '';
    document.getElementById('discover-no-results').style.display='none';
    document.getElementById('discover-in-progress').style.display='block';

    discoverFeeds({
      query: query,
      oncomplete: onDiscoverFeedsComplete,
      onerror: onDiscoverFeedsError,
      timeout: 5000
    });
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
    image.setAttribute('src', getFavIconURL(result.url));
    image.title = result.link;
    item.appendChild(image);

    var a = document.createElement('a');
    a.setAttribute('href', result.link);
    a.setAttribute('target', '_blank');
    a.title = stripTags(result.title);
    a.innerHTML = truncate(result.title, 70);
    item.appendChild(a);

    // The snippet contains HTML, not text. It does this because
    // Google provides pre-emphasized text that corresponds to the
    // query. So we want to get rid of only certain tags, not all
    // tags.
    var snippetSpan = document.createElement('span');
    snippetSpan.innerHTML = truncate(stripBRs(result.contentSnippet), 400);
    item.appendChild(snippetSpan);

    var span = document.createElement('span');
    span.setAttribute('class','discover-search-result-url');
    span.textContent = result.url;
    item.appendChild(span);
  });
}

function onDiscoverFeedsError(errorMessage) {
  document.getElementById('discover-in-progress').style.display='none';
  console.dir(errorMessage);
  showErrorMessage('An error occurred when searching for feeds. Details: ' + errorMessage);
}

function onUnsubscribeButtonClicked(event) {
  var feedId = parseInt(event.target.value);
  openIndexedDB(function(db) {
    removeFeedById(db, feedId, function() {
      console.log('unsubscribed from %s', feedId);
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

function onFileInputChanged(event) {
  if(!event.target.files || !event.target.files.length) return;
  // TODO: start import progress monitor
  importOPMLFiles(event.target.files,
    function(feedsImported, totalFeedsAttempted, exceptions) {
      event.target.removeEventListener('change', onFileInputChanged);
      document.body.removeChild(event.target);
      onFeedsImported(feedsImported, totalFeedsAttempted, exceptions);
  });
};

function onFeedsImported(feedsImported, totalFeedsAttempted, exceptions) {
  if(exceptions && exceptions.length) {
    console.dir(exceptions);
  }

  // TODO: stop the import progress monitor
  // TODO: notify the user
  // switch to section
  console.log('feed imported');
}


function onExportOPMLClick(event) {
  exportOPMLString(function(xmlString) {
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
  if(event.target.value) localStorage.HEADER_FONT_FAMILY = event.target.value;
  else delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBodyFontChange(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function onBackgroundImageChange(event) {
  if(event.target.value) localStorage.BACKGROUND_IMAGE = event.target.value;
  else delete localStorage.BACKGROUND_IMAGE;
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

function initOptionsPage(event) {
  document.removeEventListener('DOMContentLoaded', initOptionsPage);

  optionsShowSection(document.getElementById('mi-subscriptions'));

  document.getElementById('mi-content-filters').style.display =
    localStorage.ENABLE_CONTENT_FILTERS ? 'block' : 'none';

  document.getElementById('mi-embeds').style.display =
    localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';

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

  Array.prototype.forEach.call(document.querySelectorAll('#navigation-menu li'),
    setNavigationOnClick);

  // Initialize the subscriptions list
  var feedCount = 0;
  openIndexedDB(function(db) {

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
  });

  document.getElementById('enable-subscription-preview').checked = !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  document.getElementById('enable-subscription-preview').onchange = onEnableSubscriptionPreviewChange;
  document.getElementById('details-unsubscribe').onclick = onUnsubscribeButtonClicked;
  document.getElementById('subscription-form').onsubmit = onSubscribeSubmit;
  document.getElementById('enable-content-filters').checked = !!localStorage.ENABLE_CONTENT_FILTERS;
  document.getElementById('enable-content-filters').onchange = onEnableContentFiltersChange;
  document.getElementById('rewriting-enable').checked = !!localStorage.URL_REWRITING_ENABLED;
  document.getElementById('rewriting-enable').onchange = onEnableURLRewritingChange;
  document.getElementById('button-export-opml').onclick = onExportOPMLClick;
  document.getElementById('button-import-opml').onclick = onImportOPMLClick;
  document.getElementById('subscription-preview-continue').onclick = onPostPreviewSubscribeClick;

  applyEntryStylesOnLoad();

  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  document.getElementById('entry-background-image').appendChild(option);

  BACKGROUND_IMAGES.forEach(function(path) {
    option = document.createElement('option');
    option.value = path;
    //option.textContent = path.substring(15);
    option.textContent = path;
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

  FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  });

  FONT_FAMILIES.forEach(function(fontFamily) {
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

  document.getElementById('header-font-size').value = localStorage.HEADER_FONT_SIZE || '';
  document.getElementById('header-font-size').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value)
        localStorage.HEADER_FONT_SIZE = event.target.value;
      else
        delete localStorage.HEADER_FONT_SIZE;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  document.getElementById('body-font-size').value = localStorage.BODY_FONT_SIZE || '';
  document.getElementById('body-font-size').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value)
        localStorage.BODY_FONT_SIZE = event.target.value;
      else
        delete localStorage.BODY_FONT_SIZE;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  document.getElementById('justify-text').checked = (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  document.getElementById('justify-text').onchange = onJustifyChange;
  document.getElementById('body-line-height').value = localStorage.BODY_LINE_HEIGHT || '';
  document.getElementById('body-line-height').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value)
        localStorage.BODY_LINE_HEIGHT = event.target.value;
      else
        delete localStorage.BODY_LINE_HEIGHT;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  document.getElementById('create-filter-action').onclick = onCreateContentFilterClick;

  loadContentFilterRules().forEach(function(rule){
    appendContentFilterRule(document.getElementById('content-filters-list'), rule);
  });

  var manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name || '?';
  document.getElementById('extension-version').textContent = manifest.version || '?';
  document.getElementById('extension-author').textContent = manifest.author || '?';
  document.getElementById('extension-description').textContent = manifest.description || '';
  document.getElementById('extension-homepage').textContent = manifest.homepage_url || '';
};


document.addEventListener('DOMContentLoaded', initOptionsPage);



/*
// TODO: can onFileInputChanged remove the input element
// or do we need to wait until the file was read in the callback?
// TODO: catch numerical error codes in onFileReaderLoad
// instead of English sentence strings
// TODO: notify the user if there was an error parsing the OPML
// in onFileReaderLoad
// TODO: onFeedsImported needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.

*/