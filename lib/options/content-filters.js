// TODO: simplify the preview to just be textarea with preview button
// TODO: clear content preview stuff when unsubscribing
// TODO: in onRemoveMessage, should not be using id=x because could conflate, 
//       use something like id=ruleX

var contentFiltering = {};

contentFiltering.app = chrome.extension.getBackgroundPage();

contentFiltering.appendRule = function(listElement, rule) {
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = app.contentFiltering.ruleToString(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  button.onclick = contentFiltering.onRemoveClick;
  listItem.appendChild(button);
  listElement.appendChild(listItem);
};

contentFiltering.onRemoveClick = function(event) {
  event.target.removeEventListener('click', contentFiltering.onRemoveClick);
  contentFiltering.app.contentFiltering.removeRule(parseInt(event.target.value));
};

contentFiltering.onRemoveMessage = function(event) {
  if(event.type != 'removedContentFilterRule')
    return;

  var node = document.querySelector('ul[id="content-filters-list"] li[id="'+event.rule+'"]');
  if(node) {
    node.parentNode.removeChild(node);
  }
};

contentFiltering.onCreateClick = function(event) {
  var tag = document.getElementById('create-filter-tag-name');
  var attr = document.getElementById('create-filter-attribute-name');
  var match = document.getElementById('create-filter-attribute-value-match');
  contentFiltering.app.contentFiltering.createRule(tag.value, attr.value, match.value);
};

contentFiltering.onCreateMessage = function (event) {
  if(event.type != 'createContentFilter') {
    return;
  }

  document.getElementById('create-filter-tag-name').value = '';
  document.getElementById('create-filter-attribute-name').value = '';
  document.getElementById('create-filter-attribute-value-match').value = '';
  contentFiltering.appendRule(document.getElementById('content-filters-list'), event.rule);
}

contentFiltering.onUnsubscribeMessage = function(event) {
  if(event.type != 'unsubscribe') {
    return;
  }

  // TODO:
  // Update the preview area, remove the feed from the list.
  // Also, if it was currently used in the preview, reset the the preview
  // TODO: is event.feed even the right lookup? am i storing feed id in that menu?
  // var option = document.querySelector('select#raw-browser-select-feed option[value="'+event.feed+'"]');
  // option.parentNode.removeChild. etc....
};

contentFiltering.onSelectFeed = function(event) {
  var selectEntry = document.getElementById('raw-select-entry');
  var hiddenList = document.getElementById('raw-content-holder-hidden');
  var viewer = document.getElementById('raw-content-viewer');
  var filteredViewer = document.getElementById('filtered-content-viewer');

  selectEntry.innerHTML = '';
  hiddenList.innerHTML = '';
  viewer.innerHTML = '';
  filteredViewer.innerHTML = '';

  if(!event.target.value) {
    return;
  }

  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Select an article';
  selectEntry.appendChild(option);

  var counter = 0;
  contentFiltering.app.fetcher.fetch(event.target.value, function(xml) {
    var feed = contentFiltering.app.xml2json.transform(xml);
    contentFiltering.app.collections.each(feed.entries, function(entry) {
      var option = document.createElement('option');
      option.value = counter;
      option.textContent = contentFiltering.app.strings.truncate(entry.title, 100);
      selectEntry.appendChild(option);

      var li = document.createElement('li');
      li.id = 'entry' + counter;
      li.textContent = entry.content;
      hiddenList.appendChild(li);
      counter++;
    }, function() {
      console.log('fetch error');
    }, 2000);
  });  
};

contentFiltering.onSelectEntry = function(event) {
  var rawViewer = document.getElementById('raw-content-viewer');
  var filteredViewer = document.getElementById('filtered-content-viewer');
  var list = document.getElementById('raw-content-holder-hidden');

  var index = event.target.value;
  if(!index) {
    list.innerHTML = '';
    rawViewer.innerHTML = '';
    filteredViewer.innerHTML = '';
    return;
  }

  var item = list.querySelector('li[id="entry'+index+'"');
  rawViewer.innerHTML = item.innerHTML.replace(/&lt;/g,'<br>$&').replace(/&gt;/g,'$&<br>');

  var ruleStore = contentFiltering.app.contentFiltering.loadRules();
  var htmlObj = contentFiltering.app.htmlParser.parse(item.textContent);
  contentFiltering.app.sanitizer.sanitize('http://', htmlObj, ruleStore);
  // Escape
  filteredViewer.textContent = htmlObj.innerHTML;
  // Pretty print
  filteredViewer.innerHTML = 
    filteredViewer.innerHTML.replace(/&lt;/g,'<br>$&').replace(/&gt;/g,'$&<br>');  
};

contentFiltering.onEnabledChange = function(event) {
    if(event.target.checked) {
      localStorage.ENABLE_CONTENT_FILTERS = '1';
    } else {
      delete localStorage.ENABLE_CONTENT_FILTERS;
    }

    // TODO: Broadcast event?  
};

contentFiltering.init = function(event) {
  document.removeEventListener('DOMContentLoaded', contentFiltering.init);

  document.getElementById('create-filter-action').onclick = contentFiltering.onCreateClick;

  // Init the change handler for enable disable property
  // and also set the default property
  var enableContentFilters = document.getElementById('enable-content-filters');
  enableContentFilters.checked = localStorage.ENABLE_CONTENT_FILTERS ? true : false;
  enableContentFilters.onchange = contentFiltering.onEnabledChange;

  // Init the preview area
  var tabRaw = document.getElementById('content-filter-view-original');
  var tabFiltered = document.getElementById('content-filter-view-filtered');
  var rawViewer = document.getElementById('raw-content-viewer');
  var filteredViewer = document.getElementById('filtered-content-viewer');
  var rawBrowserFeedList = document.getElementById('raw-browser-select-feed');
  var selectEntry = document.getElementById('raw-select-entry');

  tabRaw.onclick = function() {
    rawViewer.style.display = 'block';
    filteredViewer.style.display='none';
  };

  tabFiltered.onclick = function() {
    rawViewer.style.display = 'none';
    filteredViewer.style.display='block';
  };

  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Select a feed URL';
  rawBrowserFeedList.appendChild(option);

  contentFiltering.app.model.connect(function(db) {
    contentFiltering.app.model.forEachFeed(db, function(feed) {
      var option = document.createElement('option');
      option.value = feed.url;
      option.title = feed.title;
      option.textContent = app.strings.truncate(feed.title, 30);
      rawBrowserFeedList.appendChild(option);
    }, null, true);
  });
  
  rawBrowserFeedList.onchange = contentFiltering.onSelectFeed;
  selectEntry.onchange = contentFiltering.onSelectEntry;  

  // Load up and display the existing rules
  var rulesList = document.getElementById('content-filters-list');
  contentFiltering.app.contentFiltering.loadRules().forEach(function(rule){
    contentFiltering.appendRule(rulesList, rule);
  });  
};

document.addEventListener('DOMContentLoaded', contentFiltering.init);
chrome.runtime.onMessage.addListener(contentFiltering.onRemoveMessage);
chrome.runtime.onMessage.addListener(contentFiltering.onCreateMessage);
chrome.runtime.onMessage.addListener(contentFiltering.onUnsubscribeMessage);