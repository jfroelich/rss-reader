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
// TODO: content-filtering - clear content preview stuff when unsubscribing
// TODO: content-filtering - in onRemoveContentFilterMessage, should not be using id=x
// because could conflate, use something like id=cfruleX

var opt = {};

//////////////////////////////////////////////////////////////////////////////////////////////////
// message event dispatcher
opt.MessageDispatcher = {};
opt.MessageDispatcher.onMessage = function(message) {
  if('createContentFilter' == message.type) {
    opt.onCreateContentFilterMessage(message);
  } else if('createRewriteRule' == message.type) {
    opt.onURLRewritingRuleCreatedMessage(message);
  } else if('displaySettingsChanged' == message.type) {
    opt.onDisplaySettingsChangedMessage(message);
  } else if('pollCompleted' == message.type) {
    // noop
  } else if('removedContentFilterRule' == message.type) {
    opt.onRemoveContentFilterMessage(message);
  } else if('removeRewriteRule' == message.type) {
    opt.onRewritingRuleRemoved(message);
  } else if('subscribe' == message.type) {
    opt.onSubscribeMessage(message);
  } else if('unsubscribe' == message.type) {
    opt.onFeedUnsubscribedMessage(message);
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

//////////////////////////////////////////////////////////////////////////////////////////////////
// Actions

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

// TODO: stop using custom feed attribute
opt.appendFeed = function(feed, insertedSort) {

  // Some temp debugging
  if(!feed)
    throw 'feed undefined';

  var app = chrome.extension.getBackgroundPage();
  var item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);
  item.setAttribute('feed',feed.id);
  item.setAttribute('title', app.strings.stripTags(feed.description) || '');

  // TODO: remember to remove this event listener if unsubscribing
  // TODO: rename, use the usual on.. convention
  item.onclick = opt.feedListItemClick;
  
  var favIcon = document.createElement('img');
  favIcon.src = app.favIcon.getURL(feed.link);
  if(feed.title) favIcon.title = feed.title;
  item.appendChild(favIcon);
  
  var title = document.createElement('span');
  title.textContent = app.strings.truncate(feed.title,50) || 'Untitled';
  item.appendChild(title);

  if(insertedSort) {
    var currentItems = $('#feedlist').childNodes;
    var added = false;
    // TODO: use collections.until or something to that effect
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

opt.startSubscription = function(url) {

  // TODO: enable offline subscription
  if(!navigator.onLine) {
    opt.errorMessage.show('Unable to subscribe while offline.');
    return;
  }

  opt.SubscriptionMonitor.show();
  var app = chrome.extension.getBackgroundPage();
  app.model.connect(function(db) {

    opt.SubscriptionMonitor.update('Checking for existing subscription...');

    app.model.isSubscribed(db, url, function(subscribed){      
      if(subscribed) {

        opt.SubscriptionMonitor.hide(function() {
          opt.errorMessage.show('You are already subscribed to "' + url + '".');  
        });
        
      } else {
        // Load up content filter rules
        var contentFilterRules = app.contentFiltering.loadRules();
        opt.SubscriptionMonitor.update('Downloading "'+url+'"...');
        app.feedUpdater.updateFeed({url: url},
          opt.onSubscribeComplete, 5000, contentFilterRules);
      }
    });
  });
};



opt.populateFeedDetailsSection = function(feedId) {
  var app = chrome.extension.getBackgroundPage();
  app.model.connect(function(db) {
    app.model.getFeedById(db, feedId, function(feed) {
      $('#details-title').textContent = feed.title || 'Untitled';
      $('#details-favicon').setAttribute('src', app.favIcon.getURL(feed.url));
      $('#details-feed-description').textContent = 
        app.strings.stripTags(feed.description) || 'No description';
      $('#details-feed-url').textContent = feed.url;
      $('#details-feed-link').textContent = feed.link;
      $('#details-unsubscribe').value = feed.id;
    });
  });
};

opt.appendContentFilterRule = function(listElement, rule) {
  var app = chrome.extension.getBackgroundPage();
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = app.contentFiltering.ruleToString(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  button.onclick = opt.onRemoveContentFilterClick;
  listItem.appendChild(button);
  listElement.appendChild(listItem);
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// Event handlers

opt.feedListItemClick = function(event) {

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
  
  var app = chrome.extension.getBackgroundPage();

  if(app.URI.isValid(app.URI.parse(query))) {
    $('#discover-results-list').innerHTML = '';
    $('#discover-no-results').style.display='none';
     $('#discover-in-progress').style.display='none';
    $('#subscribe-discover-query').value = '';
    opt.startSubscription(query);
  } else {
    $('#discover-results-list').innerHTML = '';
    $('#discover-no-results').style.display='none';
    $('#discover-in-progress').style.display='block';
    app.googleFeeds.search(query,opt.onDiscoverFeedsComplete, 
      opt.onDiscoverFeedsError, 5000);
  }
  return false;
};

opt.onSubscribeComplete = function(feed, entriesProcessed, entriesAdded) {
  if(feed.error) {
    opt.SubscriptionMonitor.hide(function() {
      opt.errorMessage.show('Unable to subscribe to "'+ feed.url+'". ' + 
        (feed.error || 'An unknown error occurred.'));
    });
    return;
  }

  opt.SubscriptionMonitor.update('Successfully subscribed! Added '+ entriesAdded + 
    ' articles.');
  var doFadeOutSubMonitorOnSuccess = true;
  opt.SubscriptionMonitor.hide(function(){}, doFadeOutSubMonitorOnSuccess);

  // TODO: should we not be doing this here? should this be from some function
  // in the background page that broadcasts instead? Maybe as some flag 
  // passed into the subscribe function? Part of a group of flags related 
  // to whether visual feedback should be involved, and what type of feedback
  var app = chrome.extension.getBackgroundPage();

  // TODO: check if notifications enabled
  app.notifications.show(
    'Subscribed to ' + feed.title + '. Found ' + 
      entriesAdded + ' new articles.');

  // TODO: shouldnt the broadcast happen in other places?
  // Idea: pass in something like context:'visual' here
  chrome.runtime.sendMessage({type:'subscribe',feed:feed});

  // TODO: Navigate to the feed's details?
};

opt.onSubscribeMessage = function(event) {
  var app = chrome.extension.getBackgroundPage();
  app.browserAction.updateBadge();
  opt.appendFeed(event.feed, true);
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

  opt.startSubscription(url);
};

opt.onDiscoverFeedsComplete = function(query, results) {
  var resultsList = $('#discover-results-list');
  $('#discover-in-progress').style.display='none';

  if(results.length < 1) {
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
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  var app = chrome.extension.getBackgroundPage();

  app.collections.each(results, function(result){

    // The snippet contains HTML, not text. It does this because 
    // Google provides pre-emphasized text that corresponds to the 
    // query. So we want to get rid of only certain tags, not all
    // tags.

    var snippet = result.contentSnippet.replace('<br>','');

    var favIconURL = app.favIcon.getURL(result.url);

    // TODO: just create the elements normally so I dont do stuff
    // like the query selector after

    listItem = document.createElement('li');
    listItem.innerHTML = [
      '<button value="',result.url,'" title="',
      app.strings.escapeHTMLAttribute(result.url),
      '">Subscribe</button>','<img src="',favIconURL,'" title="',
      app.strings.escapeHTMLAttribute(result.link),'">',
      '<a href="',result.link,'" title="',
      app.strings.escapeHTMLAttribute(result.link),
      '" target="_blank">',result.title,'</a> ',
      app.strings.truncate(snippet,400),
      '<span class="discover-search-result-url">',
      app.strings.escapeHTML(result.url),'</span>'
    ].join('');

    var button = listItem.querySelector('button');
    button.onclick = opt.discoverSubscribeClick;
    resultsList.appendChild(listItem);
  });
};

opt.onDiscoverFeedsError = function(errorMessage) {
  $('#discover-in-progress').style.display='none';
  opt.errorMessage.show('An error occurred when searching for feeds. Details: ' + errorMessage);
};

opt.onUnsubscribeButtonClicked = function(event) {
  var app = chrome.extension.getBackgroundPage();
  app.feedUpdater.unsubscribe(parseInt(event.target.value));
};

opt.onFeedUnsubscribedMessage = function(event) {
  var item = $('#feedlist li[feed="'+event.feed+'"]')
  if(item) $('#feedlist').removeChild(item);
  if($('#feedlist').childElementCount == 0) {
    $('#feedlist').style.display = 'none';
    $('#nosubscriptions').style.display = 'block';
  }

  // TODO: fix these
  opt.updateFeedCountMessage();
  opt.showSection($('#mi-add-subscription'));

  // TODO: reflect changes in content filtering
  // Update the preview area, remove the feed from the list.
  // Also, if it was currently used in the preview, reset the the preview
  // TODO: is event.feed even the right lookup? am i storing feed id in that menu?
  // var option = document.querySelector('select#raw-browser-select-feed option[value="'+event.feed+'"]');
  // option.parentNode.removeChild. etc....
};

opt.onDisplaySettingsChangedMessage = function(message) {
    // In stylize.js
    applyEntryStylesOnchange(message);  
};

opt.onEnableURLRewritingChange = function(event) {
  if(event.target.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
    $('#mi-rewriting').style.display = 'block';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
    $('#mi-rewriting').style.display = 'none';
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
  var app = chrome.extension.getBackgroundPage(), feeds = [];

  // What would clean this up is a model function that 
  // exposed the feed list as an in mem array.
  // That way we dont do the building ourselves, and we 
  // dont need to track a closure variable (like feeds above
  // which I keep forgetting about)

  var onSelectFeedsComplete = function() {
    var xmlDocument = app.opml.createXMLDocument(feeds);
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

  app.model.connect(function(db) {
    app.model.forEachFeed(db, onSelectFeed, onSelectFeedsComplete);
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
  var app = chrome.extension.getBackgroundPage();
  if(!event.target.files || !event.target.files.length) return;

  // TODO: start import progress monitor

  app.feedsImporter.importOPMLFiles(event.target.files, 
    function(feedsImported, totalFeedsAttempted, exceptions) {
      event.target.removeEventListener('change', opt.onFileInputChanged);
      document.body.removeChild(event.target);
      opt.onFeedsImported(feedsImported, totalFeedsAttempted, exceptions);
  });
};

opt.onCreateContentFilterClick = function(event) {
  var app = chrome.extension.getBackgroundPage();
  app.contentFiltering.createRule(
    $('#create-filter-tag-name').value, 
    $('#create-filter-attribute-name').value, 
    $('#create-filter-attribute-value-match').value);
};

opt.onRemoveContentFilterClick = function(event) {
  event.target.removeEventListener('click', opt.onRemoveContentFilterClick);
  var app = chrome.extension.getBackgroundPage();
  app.contentFiltering.removeRule(parseInt(event.target.value));
};

opt.onCreateContentFilterMessage = function (event) {
  $('#create-filter-tag-name').value = '';
  $('#create-filter-attribute-name').value = '';
  $('#create-filter-attribute-value-match').value = '';
  opt.appendContentFilterRule($('#content-filters-list'), event.rule);
};

opt.onRemoveContentFilterMessage = function(event) {
  var node = $('ul[id="content-filters-list"] li[id="'+event.rule+'"]');
  if(node) node.parentNode.removeChild(node);
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
  var app = chrome.extension.getBackgroundPage();
  var counter = 0;
  app.fetcher.fetch(event.target.value, function(xml) {
    var feed = app.xml2json.transform(xml);
    app.collections.each(feed.entries, function(entry) {
      var option = document.createElement('option');
      option.value = counter;
      option.textContent = app.strings.truncate(entry.title, 100);
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

  // TODO: consider better pretty printing techniques
  // https://developer.mozilla.org/en-US/docs/Parsing_and_serializing_XML
  // var oSerializer = new XMLSerializer();
  // var sPrettyXML = XML(oSerializer.serializeToString(doc)).toXMLString();

  var item = $('#raw-content-holder-hidden li[id="entry'+event.target.value+'"');
  $('#raw-content-viewer').innerHTML = item.innerHTML.replace(/&lt;/g,
    '<br>$&').replace(/&gt;/g,'$&<br>');

  var app = chrome.extension.getBackgroundPage();
  var html = app.htmlParser.parse(item.textContent);
  app.sanitizer.sanitize('http://', html, app.contentFiltering.loadRules());
  // Escape
  $('#filtered-content-viewer').textContent = html.innerHTML;

  // Pretty print
  $('#filtered-content-viewer').innerHTML = 
    $('#filtered-content-viewer').innerHTML.replace(/&lt;/g,
      '<br>$&').replace(/&gt;/g,'$&<br>');  
};

opt.onRewritingRuleRemoved = function(event) {
  var element = $('ul#rewrite-rules-list li[rule="'+event.rule.id+'"]');
  element.parentNode.removeChild(element);
};

opt.onURLRewritingRuleCreatedMessage = function(event) {
  var item = document.createElement('li');
  var app = chrome.extension.getBackgroundPage();
  item.setAttribute('rule', event.rule.id);
  item.textContent = app.rewriting.ruleToString(event.rule);
  item.onclick = opt.onRemoveRewritingRuleClick;
  var button = document.createElement('button');
  button.textContent = 'Remove';
  item.appendChild(button);
  $('#rewrite-rules-list').appendChild(item);
};

opt.onRemoveRewritingRuleClick = function(event) {
  if(event.target.localName != 'button') return;
  event.currentTarget.removeEventListener('click', opt.onRemoveRewritingRuleClick);
  var ruleId = parseInt(event.currentTarget.getAttribute('rule'));  
  var app = chrome.extension.getBackgroundPage();
  app.rewriting.removeRule(ruleId);
};

opt.onTestRewritingRulesClick = function(event) {
  var inputValue = ($('#rewriting-test-input').value || '').trim();
  if(!inputValue) return;
  var app = chrome.extension.getBackgroundPage();
  var outputValue = app.rewriting.rewriteURL(app.rewriting.loadRules(), inputValue);
  $('#rewriting-test-output').value = outputValue ? outputValue : 'No match';
};

opt.onCreateRewritingRuleClick = function(event) {

  var path = ($('#rewriting-create-path').value || '').trim();
  var param = ($('#rewriting-create-parameter').value || '').trim();

  if(!path) {
    alert('Base URL is required. Rewrite rule not created.');
    return;
  }
  
  var app = chrome.extension.getBackgroundPage();
  var testURL = app.URI.parse(path);
  if(!app.URI.isValid(testURL)) {
    alert('Invalid Base URL. Rewrite rule not created. Check that you did not use spaces');
    return;
  }

  app.rewriting.createRule(path, param);
  $('#rewriting-create-path').value = '';
  $('#rewriting-create-parameter').value = '';
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

//////////////////////////////////////////////////////////////////////////////////////////////////
// Initialization

opt.init = function(event) {
  document.removeEventListener('DOMContentLoaded', opt.init);

  var app = chrome.extension.getBackgroundPage();
  
  // Show the default section
  opt.showSection($('li#mi-subscriptions'));

  // Hide disabled navigation sections
  $('li#mi-content-filters').style.display = 
    localStorage.ENABLE_CONTENT_FILTERS ? 'block' : 'none';
  $('li#mi-rewriting').style.display = 
    localStorage.URL_REWRITING_ENABLED ? 'block' : 'none';
  $('li#mi-embeds').style.display = 
    localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';

  // Setup click handlers for navigation menu items
  app.collections.each($$('ul#navigation-menu li'), opt.setNavigationOnClick);

  // Initialie the subscriptions list
  var feedCount = 0;
  app.model.connect(function(db) {
    app.model.forEachFeed(db, function(feed) {
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

  $('#details-unsubscribe').onclick = opt.onUnsubscribeButtonClicked;
  $('#subscription-form').onsubmit = opt.onSubscribeSubmit;
  $('#enable-content-filters').checked = localStorage.ENABLE_CONTENT_FILTERS ? true : false;
  $('#enable-content-filters').onchange = opt.onEnableContentFiltersChange;
  $('#rewriting-enable').checked = localStorage.URL_REWRITING_ENABLED ? true : false;
  $('#rewriting-enable').onchange = opt.onEnableURLRewritingChange;
  $('#button-export-opml').onclick = opt.onExportOPMLClick;
  $('#button-import-opml').onclick = opt.onImportOPMLClick;

  // Apply styles to the preview (from stylize.js)
  applyEntryStylesOnload();
  
  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  $('#entry-background-image').appendChild(option);
  
  BACKGROUND_IMAGES.forEach(function(path) {
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring(15);
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

  FONT_FAMILIES.forEach(function(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily == localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    $('#select_header_font').appendChild(option);
  });

  FONT_FAMILIES.forEach(function(fontFamily) {
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
  $('#entry-background-color').oninput = function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function(){
      if(event.target.value && event.target.value.trim().length)
        localStorage.ENTRY_BACKGROUND_COLOR = event.target.value.trim();
      else delete localStorage.ENTRY_BACKGROUND_COLOR;
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});      
    }, inputChangedDelay);
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
  $('#content-filter-view-original').onclick = function() {
    $('#raw-content-viewer').style.display = 'block';
    $('#filtered-content-viewer').style.display='none';
  };
  $('#content-filter-view-filtered').onclick = function() {
    $('#raw-content-viewer').style.display = 'none';
    $('#filtered-content-viewer').style.display='block';
  };

  option = document.createElement('option');
  option.value = '';// NIT: This must be defined, right?
  option.textContent = 'Select a feed URL';
  $('#raw-browser-select-feed').appendChild(option);

  app.model.connect(function(db) {
    app.model.forEachFeed(db, function(feed) {
      var option = document.createElement('option');
      option.value = feed.url;
      option.title = feed.title;
      option.textContent = app.strings.truncate(feed.title, 30);
      $('#raw-browser-select-feed').appendChild(option);
    }, null, true);
  });

  $('#raw-browser-select-feed').onchange = opt.onContentFiltersPreviewSelectFeed;
  $('#raw-select-entry').onchange = opt.onContentFiltersPreviewSelectEntry;  

  app.contentFiltering.loadRules().forEach(function(rule){
    opt.appendContentFilterRule($('#content-filters-list'), rule);
  });

  $('#rewriting-create').onclick = opt.onCreateRewritingRuleClick
  $('#rewriting-test').onclick = opt.onTestRewritingRulesClick;

  var rewritingRulesList = $('#rewrite-rules-list');  
  app.rewriting.loadRules().forEach(function(rule) {
    var item = document.createElement('li');
    item.textContent = app.rewriting.ruleToString(rule);
    var button = document.createElement('button');
    button.value = rule.id;
    button.textContent = 'Remove';
    item.setAttribute('rule', rule.id);
    item.appendChild(button);
    item.onclick = opt.onRemoveRewritingRuleClick;
    rewritingRulesList.appendChild(item);
  });


  // Init the About section
  var manifest = chrome.runtime.getManifest();
  $('#extension-name').textContent = manifest.name || '?';
  $('#extension-version').textContent = manifest.version || '?';
  $('#extension-author').textContent = manifest.author || '?';
  $('#extension-description').textContent = manifest.description || '';
  $('#extension-homepage').textContent = manifest.homepage_url || ''; 
};

// Bindings
chrome.runtime.onMessage.addListener(opt.MessageDispatcher.onMessage);
document.addEventListener('DOMContentLoaded', opt.init);