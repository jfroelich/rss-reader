// TODO: make into IEAF

var app = app || chrome.extension.getBackgroundPage();

//Appends a new rule in the filters list
function appendContentFilterRule(rule) {
  //console.log('Appending content filter rule %s', JSON.stringify(rule));
  
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
  // Remove the listener here as the containing list item element
  // will be removed
  event.target.removeEventListener('click', removeContentFilterClick);

  var ruleId = parseInt(event.target.value);
  
  app.removeContentFilter(ruleId);
}

chrome.runtime.onMessage.addListener(function(event) {
  if(event.type != 'removedContentFilterRule') {
    return;
  }

  var ruleId = event.rule;
  console.log('Removing content filter rule list item with id %s', ruleId);
  var node = document.querySelector('ul[id="content-filters-list"] li[id="'+ruleId+'"]');
  if(node) {
    node.parentNode.removeChild(node);
  } else {
    console.warn('Could not find the list item content filter rule with id %s', ruleId);
  }
});

function createContentFilterClick(event) {

  var feedMenu = document.getElementById('create-filter-feed');
  var typeMenu = document.getElementById('create-filter-type');

  var rule = {
    'feed': parseInt(feedMenu.options[feedMenu.selectedIndex].value),
    'type': typeMenu.options[typeMenu.selectedIndex].value,
    'match': document.getElementById('create-filter-match').value || ''
  };

  app.createContentFilterRule(rule);
}

// Listen for content filter created events
chrome.runtime.onMessage.addListener(function (event) {
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
});


function contentFilterUnsubscribeMessageListener(event) {
  if(event.type != 'unsubscribe') {
    return;
  }
  
  var elementSelectFeed = document.getElementById('create-filter-feed');
  

  // Remove the feed from the create content filter menu
  var feedOption = elementSelectFeed.querySelector('option[value="'+event.feed+'"]');
  if(feedOption) {
    // console.log('Removing feed with id %s from create content filter form', event.feed);
    elementSelectFeed.removeChild(feedOption);
  } else {
    console.log('Could not locate feed in create content filter feed menu for id %s', event.feed);
  }

  // TODO: Remove content filter rules specific to the feed
  // from the content filter ui
  
  // Find all list items pertaining to this feed? How? Probably
  // need to set attribute?
}

chrome.runtime.onMessage.addListener(contentFilterUnsubscribeMessageListener);


function createContentFilterSelectFeedAppendOption(container, feed, insertSorted) {
  
  var option = document.createElement('option');
  option.value = feed.id;

  // Set the title attribute to help the user disambiguate post truncation
  // conflated option text
  // TODO: test whether I need to strip quotes here
  option.title = feed.title.replace('"','&quot;');

  // Constrain long feed titles
  option.textContent = app.truncate(feed.title, 30);

  if(insertSorted) {
    var added = false;
    app.until(container.childNodes, function(node) {
      if(window.indexedDB.cmp(feed.title, node.title) == -1) {
        added = true;
        container.insertBefore(option, node);
        return false;
      }
      
      return true;
    });
    
    if(!added) {
      container.appendChild(option);
    }
    
  } else {
    container.appendChild(option);  
  }
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
  
  // Initialize the Create content filter subsection
  var createFilterFeedMenu = document.getElementById('create-filter-feed');
  app.model.connect(function(db){
    app.model.forEachFeed(db, function(feed) {
      createContentFilterSelectFeedAppendOption(createFilterFeedMenu, feed, false);
    }, null, true);
  });

  // Initialize the type menu
  var createFilterTypeMenu = document.getElementById('create-filter-type');
  app.CONTENT_FILTER_TYPES.forEach(function(type) {
    var option = document.createElement('option');
    option.value = type.value;
    option.textContent = type.text;
    createFilterTypeMenu.appendChild(option);
  });

  // Listen for Create button click events
  document.getElementById('create-filter-action').addEventListener('click', createContentFilterClick);

  // Load up and display the existing rules
  var contentFiltersList = document.getElementById('content-filters-list');

  var rules = app.getContentFilterRules();

  // console.log('Initializing content filters rules list. %s rules found.', rules.length);

  rules.forEach(function(rule){
    appendContentFilterRule(rule);
  });
}

document.addEventListener('DOMContentLoaded', initContentFiltersSection);