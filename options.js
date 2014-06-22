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

// TODO: content-filtering - simplify the preview to just be textarea with preview button
// TODO: content-filtering - in onRemoveContentFilterMessage, should not be using id=x
// because could conflate, use something like id=cfruleX

var opt = {};

opt.MessageDispatcher = {};
opt.MessageDispatcher.onMessage = function(message) {
  if('displaySettingsChanged' == message.type) {
    stylize.applyEntryStylesOnchange();
  } else if('pollCompleted' == message.type) {
  } else if('subscribe' == message.type) {
    opt.appendFeed(message.feed, true);
    opt.updateFeedCountMessage();
  } else if('unsubscribe' == message.type) {
    var item = $('#feedlist li[feed="'+message.feed+'"]')
    if(item) {
      item.removeEventListener('click', opt.onFeedListItemClick);
      item.parentNode.removeChild(item);
    }

    if($('#feedlist').childElementCount == 0) {
      $('#feedlist').style.display = 'none';
      $('#nosubscriptions').style.display = 'block';
    }

    opt.updateFeedCountMessage();
    opt.showSection($('#mi-subscriptions'));
  } else if('entryRead' == message.type) {
    //console.log('entryRead %s', message.entry.id);
    // If we ever start showing unread counts per feed
    // this would need to update the unread count

  } else {
    console.warn('Unknown message type %s', message.type);
  }
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// visual error message box for options page
opt.errorMessage = {};
opt.errorMessage.hide = function(event) {
  var container = $('#options_error_message');
  if(!container) return;
  var dismissButton = $('#options_dismiss_error_button');
  if(dismissButton)
    dismissButton.removeEventListener('click', opt.errorMessage.hide);
  container.parentNode.removeChild(container);
};

opt.errorMessage.show = function(message, fadeIn) {
  opt.errorMessage.hide();

  var elMessage = document.createElement('span');
  elMessage.textContent = message;
  var dismissButton = document.createElement('button');
  dismissButton.setAttribute('id','options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = opt.errorMessage.hide;

  var container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.appendChild(elMessage);
  container.appendChild(dismissButton);

  if(fadeIn) {
    container.style.opacity = '0';
    document.body.appendChild(container);
    fx.fade(container, 0, 0);
  } else {
    container.style.display = '';
    container.style.opacity = '1';
    document.body.appendChild(container);
  }
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// Visual progress monitor for subscribbing
// TODO: instead of removing and re-adding, reset and reuse

opt.SubscriptionMonitor = {};

opt.SubscriptionMonitor.show = function() {
  opt.SubscriptionMonitor.reset();
  var container = document.createElement('div');
  container.setAttribute('id', 'options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);

  var progress = document.createElement('progress');
  progress.textContent = 'working...';
  container.appendChild(progress);
};

opt.SubscriptionMonitor.isDisplayed = function() {
  var subMonitor = $('#options_subscription_monitor');
  return subMonitor && subMonitor.style.display == 'block'
}

opt.SubscriptionMonitor.reset = function() {
  var element = $('#options_subscription_monitor');
  if(element) element.parentNode.removeChild(element);
};

// Add a message to the subscription monitor element
opt.SubscriptionMonitor.update = function (message) {
  var container = $('#options_subscription_monitor');
  if(!container) return;
  var paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}

opt.SubscriptionMonitor.hide = function(onComplete, fadeOut) {
  var container = $('#options_subscription_monitor');
  onComplete = onComplete || function(){};
  if(!container) {
    onComplete();
    return;
  }

  if(fadeOut) {
    fx.fade(container, 2, 1, function() {
      document.body.removeChild(container);
      onComplete();
    });
  } else {
    document.body.removeChild(container);
    onComplete();
  }
};


opt.showSection = function(menuItem) {
  if(!menuItem || opt.currentMenuItem_ == menuItem) {
    return;
  }

  menuItem.classList.add('navigation-item-selected');
  if(opt.currentMenuItem_)
    opt.currentMenuItem_.classList.remove('navigation-item-selected');
  if(opt.currentSection_)
    opt.currentSection_.style.display = 'none';
  var section = $('#' + menuItem.getAttribute('section'));
  if(section) {
    section.style.display = 'block';
  } else {
    // This should never happen but in case it does log something.
    console.warn('Could not locate section for %s', menuItem);
  }
  opt.currentMenuItem_ = menuItem;
  opt.currentSection_ = section;
};

opt.setNavigationOnClick = function(menuItem) {
  menuItem.onclick = opt.onNavigationClick;
};

opt.updateFeedCountMessage = function() {
  var count = $('#feedlist').childElementCount;

  if(count) {
    // Show him da klamps!
    if(count > 1000) {
      $('#subscription-count').textContent = ' (999+)';
    } else {
      $('#subscription-count').textContent = ' ('+ count +')';
    }

  } else {
    $('#subscription-count').textContent = '';
  }
};

opt.appendFeed = function(feed, insertedSort) {
  var item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed',feed.id);
  item.setAttribute('title', util.stripTags(feed.description) || '');
  item.onclick = opt.onFeedListItemClick;
  var favIconElement = document.createElement('img');
  favIconElement.src = util.getFavIconURL(feed.link);
  if(feed.title) favIconElement.title = feed.title;
  item.appendChild(favIconElement);

  var title = document.createElement('span');
  title.textContent = util.truncate(feed.title,300) || 'Untitled';
  item.appendChild(title);

  if(insertedSort) {
    var currentItems = $('#feedlist').childNodes;
    var added = false;
    // TODO: use util.until or something to that effect
    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
      if(indexedDB.cmp(feed.title || '', currentKey || '') == -1) {
        added = true;
        $('#feedlist').insertBefore(item, currentItems[i]);
        break;
      }
    }

    if(!added) {
      $('#feedlist').appendChild(item);
    }
  } else {
    $('#feedlist').appendChild(item);
  }
};

opt.onEnableSubscriptionPreviewChange = function(event) {
  if(event.target.checked) localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
};


opt.showOrSkipSubscriptionPreview = function(url) {

  console.log('showOrSkipSubscriptionPreview %s',url);
  opt.hideSubscriptionPreview();

  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    console.log('subscription preview not enabled, skipping preview');
    opt.startSubscription(url);
    return;
  }

  if(!navigator.onLine) {
    console.log('cannot preview while offline, skipping preview');
    opt.startSubscription(url);
    return;
  }

  // Preview enabled and we are online.

  // Show the preview area
  $('#subscription-preview').style.display = 'block';
  // Start an indeterminate progress bar.
  $('#subscription-preview-load-progress').style.display = 'block';

  // invalid url or parse error or exists
  var onerror = function(error) {
    console.log('error fetching %s for preview', error);
    console.dir(error);

    // If an error occurs hide the preview elements.
    opt.hideSubscriptionPreview();

    // TODO: inspect error props and show a better error message.
    // There could be parsing errors, HTTP status !200 errors,
    // unhandled content type errors, invalid xml errors, etc.
    opt.errorMessage.show('Unable to fetch ' + url);
  };

  var timeout = 10 * 1000;

  var onFetchSuccess = function(result) {
    // Stop the indeterminate progress bar.
    $('#subscription-preview-load-progress').style.display = 'none';

    // Show the title
    //$('#subscription-preview-title').style.display = 'block';
    $('#subscription-preview-title').textContent = result.title || 'Untitled';

    // Update the value of the continue button so its click handler
    // can get the vvalue for subscription
    $('#subscription-preview-continue').value = result.url;

    // result.title and  result.entries
    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No entries found to preview';
      $('#subscription-preview-entries').appendChild(item);
    }

    // Show up to 5 (inclusive) entries.
    for(var i = 0, len = Math.min(5,result.entries.length); i < len;i++) {
      var entry = result.entries[i];
      var item = document.createElement('li');
      item.textContent = entry.title;
      var content = document.createElement('span');
      content.innerHTML = entry.content;
      item.appendChild(content);
      $('#subscription-preview-entries').appendChild(item);
    }
  };

  console.log('Checking if already subscribed to %s', url);

  var fu = new FeedUpdater();
  fu.requestPreview(url,onFetchSuccess,onerror, timeout);
};

opt.hideSubscriptionPreview = function() {
  //console.log('ensuring subscription preview elements are hidden');
  $('#subscription-preview').style.display = 'none';
  // Clear the list of previewed articles
  $('#subscription-preview-entries').innerHTML = '';
  // These are inside the preview element, no need to hide them
  //$('#subscription-preview-load-progress').style.display = 'none';
  //$('#subscription-preview-continue').style.display = 'none';
};

opt.startSubscription = function(url) {

  // Done with preview, make sure it is hidden.
  opt.hideSubscriptionPreview();

  opt.SubscriptionMonitor.show();
  opt.SubscriptionMonitor.update('Subscribing...');

  ///var params = {url:url,fetch: 1,notify:1,timeout: 6000};

  var fu = new FeedUpdate();
  fu.fetch = 1;
  fu.notify = 1;
  fu.timeout = 5000;

  // Add our onerror event listener
  fu.onerror = function(err) {
    opt.SubscriptionMonitor.hide(function(){
      if(err.type == 'invalidurl') {
        // Should never happen since we treat invalid urls
        // as search queries
        opt.errorMessage.show('Not a valid url "'+url+'"');
      } if(err.type == 'exists') {
        opt.errorMessage.show('You are already subscribed to "' + url + '".');
      } else if(err.type =='responsexmlundefined') {
        opt.errorMessage.show('The URL ' +url+ ' is not a valid feed (invalid XML)');
      } else {
        console.dir(err);
        opt.errorMessage.show('Error "' + err + '".');
      }
    });
  };

  // Add our oncomplete event listener
  fu.oncomplete = function(feed, entriesProcessed,entriesAdded) {
    opt.SubscriptionMonitor.update('Subcribed to ' + feed.url);
    opt.SubscriptionMonitor.hide(function() {
      opt.showSection($('#mi-subscriptions'));
    },true);
  };

  // Start the proces
  fu.add(url);
};

opt.populateFeedDetailsSection = function(feedId) {
  model.connect(function(db) {
    db.transaction('feed').objectStore('feed').get(feedId).onsuccess = function(event) {
      var feed = event.target.result;
      $('#details-title').textContent = feed.title || 'Untitled';
      $('#details-favicon').setAttribute('src', util.getFavIconURL(feed.url));
      $('#details-feed-description').textContent =
        util.stripTags(feed.description) || 'No description';
      $('#details-feed-url').textContent = feed.url;
      $('#details-feed-link').textContent = feed.link;
      $('#details-unsubscribe').value = feed.id;
    };
  });
};

opt.appendContentFilterRule = function(listElement, rule) {
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = contentFiltering.ruleToString(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  button.onclick = opt.onRemoveContentFilterClick;
  listItem.appendChild(button);
  listElement.appendChild(listItem);
};

opt.onPostPreviewSubscribeClick = function(event) {
  var url = event.currentTarget.value;
  opt.hideSubscriptionPreview();
  opt.startSubscription(url);
};

opt.onFeedListItemClick = function(event) {

  opt.populateFeedDetailsSection(parseInt(event.currentTarget.getAttribute('feed')));

  // TODO: These calls should really be in an async callback
  // passed to populateFeedDetailsSection
  opt.showSection($('#mi-feed-details'));
  window.scrollTo(0,0);
};

opt.onNavigationClick = function(event) {

  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  opt.showSection(event.currentTarget);
};

opt.onSubscribeSubmit = function(event) {
  event.preventDefault();// Prevent normal form submission event
  var query = ($('#subscribe-discover-query').value || '').trim();
  if(!query) return false;
  if($('#discover-in-progress').style.display == 'block') return false;

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Suppress resubmits if subscription in progress
  if(opt.SubscriptionMonitor.isDisplayed()) {
    return false;
  }

  if(URI.isValid(URI.parse(query))) {
    $('#discover-results-list').innerHTML = '';
    $('#discover-no-results').style.display='none';
     $('#discover-in-progress').style.display='none';
    $('#subscribe-discover-query').value = '';
    opt.showOrSkipSubscriptionPreview(query);
  } else {
    $('#discover-results-list').innerHTML = '';
    $('#discover-no-results').style.display='none';
    $('#discover-in-progress').style.display='block';

    reader.fetch.discoverFeeds({
      query: query,
      oncomplete: opt.onDiscoverFeedsComplete,
      onerror: opt.onDiscoverFeedsError,
      timeout: 5000
    });

  }
  return false;
};


opt.discoverSubscribeClick = function(event) {
  var button = event.target;
  var url = button.value;
  if(!url) return;

  // TODO: Ignore future clicks if error was displayed?

  // Ignore future clicks while subscription in progress
  var subMonitor = $('#options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    return;
  }

  opt.showOrSkipSubscriptionPreview(url);
};

opt.onDiscoverFeedsComplete = function(query, results) {
  var resultsList = $('#discover-results-list');
  $('#discover-in-progress').style.display='none';

  // Need to filter as for some reason the discover feeds
  // service sometimes returns results that do not have a url
  var displayableResults = results.filter(function(result) {
    return result.url;
  });

  if(displayableResults.length < 1) {
    resultsList.style.display = 'none';
    $('#discover-no-results').style.display = 'block';
    return;
  }

  if(resultsList.style.display == 'block') {
    resultsList.innerHTML = '';
  } else {
    $('#discover-no-results').style.display='none';
    resultsList.style.display = 'block';
  }

  var listItem = document.createElement('li');
  listItem.textContent = 'Found ' + displayableResults.length + ' results.';
  resultsList.appendChild(listItem);

  util.each(displayableResults, function(result) {
    var item = document.createElement('li');
    resultsList.appendChild(item);

    var button = document.createElement('button');
    button.value = result.url;
    button.title = result.url;
    button.textContent = 'Subscribe';
    button.onclick = opt.discoverSubscribeClick;
    item.appendChild(button);

    var image = document.createElement('img');
    image.setAttribute('src', util.getFavIconURL(result.url));
    image.title = result.link;
    item.appendChild(image);

    var a = document.createElement('a');
    a.setAttribute('href', result.link);
    a.setAttribute('target', '_blank');
    a.title = util.stripTags(result.title);
    a.innerHTML = util.truncate(result.title, 70);
    item.appendChild(a);

    // The snippet contains HTML, not text. It does this because
    // Google provides pre-emphasized text that corresponds to the
    // query. So we want to get rid of only certain tags, not all
    // tags.
    var snippetSpan = document.createElement('span');
    snippetSpan.innerHTML =
      util.truncate(result.contentSnippet.replace('<br>',''), 400);
    item.appendChild(snippetSpan);

    var span = document.createElement('span');
    span.setAttribute('class','discover-search-result-url');
    span.textContent = result.url;
    item.appendChild(span);
  });
};

opt.onDiscoverFeedsError = function(errorMessage) {
  $('#discover-in-progress').style.display='none';
  opt.errorMessage.show('An error occurred when searching for feeds. Details: ' + errorMessage);
};

opt.onUnsubscribeButtonClicked = function(event) {
  subscriptions.remove(parseInt(event.target.value));
};


opt.onEnableURLRewritingChange = function(event) {
  if(event.target.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
  }
};

opt.onEnableContentFiltersChange = function(event) {
  if(event.target.checked) {
    localStorage.ENABLE_CONTENT_FILTERS = '1';
    $('#mi-content-filters').style.display = 'block';
  } else {
    delete localStorage.ENABLE_CONTENT_FILTERS;
    $('#mi-content-filters').style.display = 'none';
  }
};

opt.onImportOPMLClick = function(event) {
  var uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display='none';
  uploader.onchange = opt.onFileInputChanged;
  document.body.appendChild(uploader);
  uploader.click();
};

opt.onExportOPMLClick = function(event) {
  var feeds = [];

  var onSelectFeedsComplete = function() {
    var xmlDocument = opml.createXMLDocument(feeds);
    var xmlString = new XMLSerializer().serializeToString(xmlDocument);
    var blob = new Blob([xmlString], {type:'application/xml'});
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.setAttribute('download', 'subscriptions.xml');
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    URL.revokeObjectURL(blob);
    document.body.removeChild(anchor);
  };

  var onSelectFeed = function(feed) {
    feeds.push({title: feed.title,description: feed.description,
      link: feed.link,url: feed.url});
  };

  model.connect(function(db) {
    model.forEachFeed(db, onSelectFeed, onSelectFeedsComplete);
  });
};

opt.onFeedsImported = function(feedsImported, totalFeedsAttempted, exceptions) {
  if(exceptions && exceptions.length) {
    console.dir(exceptions);
  }

  // TODO: stop the import progress monitor
  // TODO: notify the user
};

opt.onFileInputChanged = function(event) {
  if(!event.target.files || !event.target.files.length) return;
  // TODO: start import progress monitor
  feedsImporter.importOPMLFiles(event.target.files,
    function(feedsImported, totalFeedsAttempted, exceptions) {
      event.target.removeEventListener('change', opt.onFileInputChanged);
      document.body.removeChild(event.target);
      opt.onFeedsImported(feedsImported, totalFeedsAttempted, exceptions);
  });
};

opt.onCreateContentFilterClick = function(event) {
  var rule = contentFiltering.createRule(
    $('#create-filter-tag-name').value,
    $('#create-filter-attribute-name').value,
    $('#create-filter-attribute-value-match').value);
  $('#create-filter-tag-name').value = '';
  $('#create-filter-attribute-name').value = '';
  $('#create-filter-attribute-value-match').value = '';
  opt.appendContentFilterRule($('#content-filters-list'), rule);
};

opt.onRemoveContentFilterClick = function(event) {
  event.target.removeEventListener('click', opt.onRemoveContentFilterClick);
  contentFiltering.removeRule(parseInt(event.target.value));
  event.currentTarget.parentNode.removeChild(event.currentTarget);
};

opt.onContentFiltersPreviewSelectFeed = function(event) {
  $('#raw-select-entry').innerHTML = '';
  $('#raw-content-holder-hidden').innerHTML = '';
  $('#raw-content-viewer').innerHTML = '';
  $('#filtered-content-viewer').innerHTML = '';
  if(!event.target.value) return;
  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Select an article';
  $('#raw-select-entry').appendChild(option);
  var counter = 0;

  subscriptions.request(event.target.value, function(xml) {
    var feed = xml2json.transform(xml);
    util.each(feed.entries, function(entry) {
      var option = document.createElement('option');
      option.value = counter;
      option.textContent = util.truncate(entry.title, 100);
      $('#raw-select-entry').appendChild(option);

      var li = document.createElement('li');
      li.id = 'entry' + counter;
      li.textContent = entry.content;
      $('#raw-content-holder-hidden').appendChild(li);
      counter++;
    }, function() {
      console.log('fetch error');
    }, 2000);
  });
};

opt.onContentFiltersPreviewSelectEntry = function(event) {
  if(!event.target.value) {
    $('#raw-content-holder-hidden').innerHTML = '';
    $('#raw-content-viewer').innerHTML = '';
    $('#filtered-content-viewer').innerHTML = '';
    return;
  }

  var item = $('#raw-content-holder-hidden li[id="entry'+event.target.value+'"');
  $('#raw-content-viewer').innerHTML = item.innerHTML.replace(/&lt;/g,
    '<br>$&').replace(/&gt;/g,'$&<br>');
  var html = util.parseHTML(item.textContent);
  sanitizer.sanitize('http://', html);
  $('#filtered-content-viewer').textContent = html.innerHTML;
  $('#filtered-content-viewer').innerHTML =
    $('#filtered-content-viewer').innerHTML.replace(/&lt;/g,
      '<br>$&').replace(/&gt;/g,'$&<br>');
};

opt.onRemoveRewritingRuleClick = function(event) {
  if(event.target.localName != 'button') return;
  event.currentTarget.removeEventListener('click', opt.onRemoveRewritingRuleClick);
  var ruleId = parseInt(event.currentTarget.getAttribute('rule'));
  rewriting.removeRule(ruleId);

  event.currentTarget.parentNode.removeChild(event.currentTarget);
};

opt.onTestRewritingRulesClick = function(event) {
  var inputValue = ($('#rewriting-test-input').value || '').trim();
  if(!inputValue) return;
  var outputValue = rewriting.rewriteURL(rewriting.loadRules(), inputValue);
  $('#rewriting-test-output').value = outputValue ? outputValue : 'No match';
};

opt.onCreateRewritingRuleClick = function(event) {

  var path = ($('#rewriting-create-path').value || '').trim();
  var param = ($('#rewriting-create-parameter').value || '').trim();

  if(!path) {
    alert('Base URL is required. Rewrite rule not created.');
    return;
  }

  var testURL = URI.parse(path);
  if(!URI.isValid(testURL)) {
    alert('Invalid Base URL. Rewrite rule not created. Check that you did not use spaces');
    return;
  }

  var rule = rewriting.createRule(path, param);
  $('#rewriting-create-path').value = '';
  $('#rewriting-create-parameter').value = '';

  var item = document.createElement('li');
  item.setAttribute('rule', rule.id);
  item.textContent = rewriting.ruleToString(rule);
  item.onclick = opt.onRemoveRewritingRuleClick;
  var button = document.createElement('button');
  button.textContent = 'Remove';
  item.appendChild(button);
  $('#rewrite-rules-list').appendChild(item);
};

opt.onHeaderFontChange = function(event){
  if(event.target.value) localStorage.HEADER_FONT_FAMILY = event.target.value;
  else delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
};

opt.onBodyFontChange = function(event) {
  if(event.target.value) localStorage.BODY_FONT_FAMILY = event.target.value;
  else delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
};

opt.onBackgroundImageChange = function(event) {
  if(event.target.value) localStorage.BACKGROUND_IMAGE = event.target.value;
  else delete localStorage.BACKGROUND_IMAGE;
  chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
};

opt.onJustifyChange = function(event) {
  if(event.target.checked) localStorage.JUSTIFY_TEXT = '1';
  else delete localStorage.JUSTIFY_TEXT;
  chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
};

opt.onEnableNotificationsChange = function(event) {
  if(event.target.checked) chrome.permissions.request({permissions:['notifications']}, function(granted) {});
  else chrome.permissions.remove({permissions:['notifications']}, function(removed) {});
};

opt.onEnableBackgroundChange = function(event) {
  if(event.target.checked) chrome.permissions.request({permissions:['background']}, function(granted) {});
  else chrome.permissions.remove({permissions:['background']}, function(removed) {});
};

opt.onEnableIdleCheckChange = function(event) {
  if(event.target.checked) chrome.permissions.request({permissions:['idle']}, function(granted){});
  else chrome.permissions.remove({permissions:['idle']}, function(removed){})
}

opt.init = function(event) {
  document.removeEventListener('DOMContentLoaded', opt.init);
  opt.showSection($('li#mi-subscriptions'));

  $('li#mi-content-filters').style.display = localStorage.ENABLE_CONTENT_FILTERS ? 'block' : 'none';
  $('li#mi-embeds').style.display = localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';
  $('#enable-notifications').onclick = opt.onEnableNotificationsChange;
  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    $('#enable-notifications').checked = permitted;
  });
  $('#enable-background').onclick = opt.onEnableBackgroundChange;
  chrome.permissions.contains({permissions:['background']}, function(permitted) {
    $('#enable-background').checked = permitted;
  });
  $('#enable-idle-check').onclick = opt.onEnableIdleCheckChange;
  chrome.permissions.contains({permissions:['idle']}, function(permitted) {
    $('#enable-idle-check').checked = permitted;
  });

  util.each($$('ul#navigation-menu li'), opt.setNavigationOnClick);

  // Initialize the subscriptions list
  var feedCount = 0;
  model.connect(function(db) {
    model.forEachFeed(db, function(feed) {
      feedCount++;
      opt.appendFeed(feed);
      opt.updateFeedCountMessage();
    }, function() {
      if(feedCount == 0) {
        $('#nosubscriptions').style.display = 'block';
        $('#feedlist').style.display = 'none';
      } else {
        $('#nosubscriptions').style.display = 'none';
        $('#feedlist').style.display = 'block';
      }
    }, true);
  });

  $('#enable-subscription-preview').checked = !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  $('#enable-subscription-preview').onchange = opt.onEnableSubscriptionPreviewChange;
  $('#details-unsubscribe').onclick = opt.onUnsubscribeButtonClicked;
  $('#subscription-form').onsubmit = opt.onSubscribeSubmit;
  $('#enable-content-filters').checked = !!localStorage.ENABLE_CONTENT_FILTERS;
  $('#enable-content-filters').onchange = opt.onEnableContentFiltersChange;
  $('#rewriting-enable').checked = !!localStorage.URL_REWRITING_ENABLED;
  $('#rewriting-enable').onchange = opt.onEnableURLRewritingChange;
  $('#button-export-opml').onclick = opt.onExportOPMLClick;
  $('#button-import-opml').onclick = opt.onImportOPMLClick;
  $('#subscription-preview-continue').onclick = opt.onPostPreviewSubscribeClick;
  stylize.applyEntryStylesOnload();

  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  $('#entry-background-image').appendChild(option);

  stylize.BACKGROUND_IMAGES.forEach(function(path) {
    option = document.createElement('option');
    option.value = path;
    //option.textContent = path.substring(15);
    option.textContent = path;
    option.selected = localStorage.BACKGROUND_IMAGE == path;
    $('#entry-background-image').appendChild(option);
  });

  $('#entry-background-image').onchange = opt.onBackgroundImageChange;

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  $('#select_header_font').appendChild(option);

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  $('#select_body_font').appendChild(option);

  stylize.FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    $('#select_header_font').appendChild(option);
  });

  stylize.FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    $('#select_body_font').appendChild(option);
  });

  $('#select_header_font').onchange = opt.onHeaderFontChange;
  $('#select_body_font').onchange = opt.onBodyFontChange;

  var inputChangedTimer, inputChangedDelay = 400;

  $('#entry-background-color').value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  $('#entry-background-color').oninput = function(){
    if(event.target.value) localStorage.ENTRY_BACKGROUND_COLOR = event.target.value;
    else delete localStorage.ENTRY_BACKGROUND_COLOR;
    chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
  };

  $('#header-font-size').value = localStorage.HEADER_FONT_SIZE || '';
  $('#header-font-size').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) localStorage.HEADER_FONT_SIZE = event.target.value;
      else delete localStorage.HEADER_FONT_SIZE;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  $('#body-font-size').value = localStorage.BODY_FONT_SIZE || '';
  $('#body-font-size').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) localStorage.BODY_FONT_SIZE = event.target.value;
      else delete localStorage.BODY_FONT_SIZE;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  $('#justify-text').checked = (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  $('#justify-text').onchange = opt.onJustifyChange;
  $('#body-line-height').value = localStorage.BODY_LINE_HEIGHT || '';
  $('#body-line-height').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) localStorage.BODY_LINE_HEIGHT = event.target.value;
      else delete localStorage.BODY_LINE_HEIGHT;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
    }, inputChangedDelay);
  };

  $('#create-filter-action').onclick = opt.onCreateContentFilterClick;

  contentFiltering.loadRules().forEach(function(rule){
    opt.appendContentFilterRule($('#content-filters-list'), rule);
  });

  var manifest = chrome.runtime.getManifest();
  $('#extension-name').textContent = manifest.name || '?';
  $('#extension-version').textContent = manifest.version || '?';
  $('#extension-author').textContent = manifest.author || '?';
  $('#extension-description').textContent = manifest.description || '';
  $('#extension-homepage').textContent = manifest.homepage_url || '';
};

chrome.runtime.onMessage.addListener(opt.MessageDispatcher.onMessage);
document.addEventListener('DOMContentLoaded', opt.init);