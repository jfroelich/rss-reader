// TODO: make into IEAF

// TODO: remember to clear content preview stuff when unsubscribing

var app = app || chrome.extension.getBackgroundPage();

function appendContentFilterRule(listElement, rule) {
  var listItem = document.createElement('li');
  listItem.id = rule.id;
  listItem.textContent = app.getRuleTextualFormat(rule);
  var button = document.createElement('button');
  button.value = rule.id;
  button.textContent = 'Remove';
  button.addEventListener('click', removeContentFilterClick);
  listItem.appendChild(button);
  listElement.appendChild(listItem);
}

function removeContentFilterClick(event) {
  event.target.removeEventListener('click', removeContentFilterClick);
  app.removeContentFilterRule(parseInt(event.target.value));
}

chrome.runtime.onMessage.addListener(function(event) {
  if(event.type != 'removedContentFilterRule') {
    return;
  }

  var ruleId = event.rule;
  // FIX THIS: should not be using id=x because could conflate, use something like id=ruleX
  var node = document.querySelector('ul[id="content-filters-list"] li[id="'+ruleId+'"]');
  if(node) {
    node.parentNode.removeChild(node);
  }
});

function createContentFilterClick(event) {
  var tag = document.getElementById('create-filter-tag-name');
  var attr = document.getElementById('create-filter-attribute-name');
  var match = document.getElementById('create-filter-attribute-value-match');

  var rule = {
    tag: tag.value,
    attr: attr.value,
    match: match.value
  };

  app.createContentFilterRule(rule);
}

// Listen for content filter created events
chrome.runtime.onMessage.addListener(function (event) {
  if(event.type != 'createContentFilter') {
    return;
  }

  document.getElementById('create-filter-tag-name').value = '';
  document.getElementById('create-filter-attribute-name').value = '';
  document.getElementById('create-filter-attribute-value-match').value = '';
  appendContentFilterRule(document.getElementById('content-filters-list'), event.rule);
});

chrome.runtime.onMessage.addListener(function(event) {
  if(event.type != 'unsubscribe') {
    return;
  }

  // Update the preview area, remove the feed from the list.
  // Also, if it was currently used in the preview, reset the the preview
  // TODO: is event.feed even the right lookup? am i storing feed id in that menu?
  // var option = document.querySelector('select#raw-browser-select-feed option[value="'+event.feed+'"]');
  // option.parentNode.removeChild. etc....
});

function onRawBrowserSelectFeedChange(event) {
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
  app.fetchFeed(event.target.value, function(xml) {
    var feed = app.xml2json(xml);
    app.each(feed.entries, function(entry) {
      var option = document.createElement('option');
      option.value = counter;
      option.textContent = app.truncate(entry.title, 100);
      selectEntry.appendChild(option);

      var li = document.createElement('li');
      li.id = 'entry' + counter;
      li.textContent = entry.content;
      hiddenList.appendChild(li);
      counter++;
    });
  });
}

function onRawBrowserSelectEntryChange(event) {
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

  var ruleStore = app.getContentFilterRules();
  var originalHTMLDocument = app.parseHTML(item.textContent);
  var sanitizedHTMLDocument = app.sanitize('http://', originalHTMLDocument, ruleStore);

  // Actually, I don't think I should trim explicitly here. Trimming
  // can be implicit, or I can give the user some explicit option to let them 
  // know.
  //trim in place
  //app.trimDocument(sanitizedHTMLDocument);
  
  
  filteredViewer.textContent = sanitizedHTMLDocument.body.innerHTML;
  filteredViewer.innerHTML = 
    filteredViewer.innerHTML.replace(/&lt;/g,'<br>$&').replace(/&gt;/g,'$&<br>');
}


function initPreviewSubsection() {
  var tabRaw = document.getElementById('content-filter-view-original');
  var tabFiltered = document.getElementById('content-filter-view-filtered');
  var rawViewer = document.getElementById('raw-content-viewer');
  var filteredViewer = document.getElementById('filtered-content-viewer');

  tabRaw.onclick = function() {
    rawViewer.style.display = 'block';
    filteredViewer.style.display='none';
  };
  
  tabFiltered.onclick = function() {
    rawViewer.style.display = 'none';
    filteredViewer.style.display='block';
  }
  
  
  // Init the raw browser section
  var rawBrowserFeedList = document.getElementById('raw-browser-select-feed');
  var selectEntry = document.getElementById('raw-select-entry');
  
  var option = document.createElement('option');
  option.value = '';
  option.textContent = 'Select a feed URL';
  rawBrowserFeedList.appendChild(option);
  
  app.model.connect(function(db) {
    app.model.forEachFeed(db, function(feed) {
      var option = document.createElement('option');
      option.value = feed.url;
      option.title = feed.title;
      option.textContent = app.truncate(feed.title, 30);
      rawBrowserFeedList.appendChild(option);
    }, null, true);
  });
  
  rawBrowserFeedList.addEventListener('change', onRawBrowserSelectFeedChange);
  
  selectEntry.addEventListener('change', onRawBrowserSelectEntryChange);
}


// Initialize the Content filters section UI
function initContentFiltersSection(event) {
  document.removeEventListener('DOMContentLoaded', initContentFiltersSection);
  
  // Init the change handler for enable disable property
  // and also set the default property
  var enableContentFilters = document.getElementById('enable-content-filters');
  enableContentFilters.checked = localStorage.ENABLE_CONTENT_FILTERS?true:false;
  enableContentFilters.addEventListener('change', function(event) {
    if(event.target.checked) {
      localStorage.ENABLE_CONTENT_FILTERS = '1';
    } else {
      delete localStorage.ENABLE_CONTENT_FILTERS;
    }
    
    // TODO: Broadcast event? May not need to.
  });
  
  
  initPreviewSubsection();

  // Listen for Create button click events
  document.getElementById('create-filter-action').addEventListener('click', createContentFilterClick);

  // Load up and display the existing rules
  var rulesList = document.getElementById('content-filters-list');
  app.getContentFilterRules().forEach(function(rule){
    appendContentFilterRule(rulesList, rule);
  });
}

document.addEventListener('DOMContentLoaded', initContentFiltersSection);