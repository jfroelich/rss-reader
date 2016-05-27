// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

// TODO: remove preview feature

const OptionsPage = {};

// TODO: what are these? elements? ints? use clearer names
// TODO: maybe make an OptionsMenu class and have these be member variables
OptionsPage.currentMenuItem = null;
OptionsPage.currentSection = null;

OptionsPage.hideElement = function(element) {
  element.style.display = 'none';
};

OptionsPage.showElement = function(element) {
  element.style.display = 'block';
};

OptionsPage.addClass = function(element, classNameString) {
  element.classList.add(classNameString);
};

OptionsPage.removeClass = function(element, classNameString) {
  element.classList.remove(classNameString);
};

OptionsPage.isElementVisible = function(element) {
  return element.style.display === 'block';
};

// TODO: maybe make an OptionsPageErrorMessage class and have show and
// hide be member functions?
OptionsPage.showErrorMessage = function(messageString, shouldFadeIn) {
  OptionsPage.hideErrorMessage();

  const errorWidgetElement = document.createElement('div');
  errorWidgetElement.setAttribute('id','options_error_message');

  const messageElement = document.createElement('span');
  messageElement.textContent = messageString;
  errorWidgetElement.appendChild(messageElement);

  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id', 'options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = OptionsPage.hideErrorMessage;
  errorWidgetElement.appendChild(dismissButton);

  if(shouldFadeIn) {
    errorWidgetElement.style.opacity = '0';
    document.body.appendChild(errorWidgetElement);
    utils.fadeElement(container, 1, 0);
  } else {
    errorWidgetElement.style.opacity = '1';
    OptionsPage.showElement(errorWidgetElement);
    document.body.appendChild(errorWidgetElement);
  }
};

// TODO: maybe make an OptionsPageErrorMessage class and have this be
// a member function.
OptionsPage.hideErrorMessage = function() {
  const errorMessage = document.getElementById('options_error_message');
  if(errorMessage) {
    const dismissButton = document.getElementById(
      'options_dismiss_error_button');
    if(dismissButton) {
      dismissButton.removeEventListener('click', OptionsPage.hideErrorMessage);
    }

    errorMessage.remove();
  }
};

// TODO: instead of removing and re-adding, reset and reuse
// TODO: maybe make an OptionsSubscriptionMonitor class and have this just be
// a member function. Call it a widget.
OptionsPage.showSubscriptionMonitor = function() {
  OptionsPage.resetSubscriptionMonitor();

  const monitorElement = document.createElement('div');
  monitorElement.setAttribute('id', 'options_subscription_monitor');
  monitorElement.style.opacity = '1';
  document.body.appendChild(monitorElement);

  const progressElement = document.createElement('progress');
  progressElement.textContent = 'Working...';
  monitorElement.appendChild(progressElement);
};

OptionsPage.resetSubscriptionMonitor = function() {
  const monitorElement = document.getElementById(
    'options_subscription_monitor');
  if(monitorElement) {
    monitorElement.remove();
  }
};

OptionsPage.updateSubscriptionMonitorMessage = function(messageString) {
  const monitorElement = document.getElementById(
    'options_subscription_monitor');
  if(!monitorElement) {
    console.error('No element with id options_subscription_monitor found');
    return;
  }

  const messageElement = document.createElement('p');
  messageElement.textContent = messageString;
  monitorElement.appendChild(messageElement);
};

OptionsPage.hideSubscriptionMonitor = function(callback, fadeOut) {
  const monitorElement = document.getElementById(
    'options_subscription_monitor');

  if(!monitorElement) {
    if(callback) {
      callback();
      return;
    }
  }

  if(fadeOut) {
    utils.fadeElement(monitorElement, 2, 1, removeThenCallCallback);
  } else {
    removeThenCallCallback();
  }

  function removeThenCallCallback() {
    if(monitorElement) {
      monitorElement.remove();
    }

    if(callback) {
      callback();
    }
  }
};

OptionsPage.showSection = function(menuItem) {
  // TODO: maybe do not check for this? Should just fail if I forgot to set it
  // somewhere.
  if(!menuItem) {
    return;
  }

  // Do nothing if not switching.
  if(OptionsPage.currentMenuItem === menuItem) {
    return;
  }

  // Make the previous item appear de-selected
  if(OptionsPage.currentMenuItem) {
    OptionsPage.removeClass(OptionsPage.currentMenuItem,
      'navigation-item-selected');
  }

  // Hide the old section
  if(OptionsPage.currentSection) {
    OptionsPage.hideElement(OptionsPage.currentSection);
  }

  // Make the new item appear selected
  OptionsPage.addClass(menuItem, 'navigation-item-selected');

  // Show the new section
  const sectionId = menuItem.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  if(sectionElement) {
    OptionsPage.showElement(sectionElement);
  }

  // Update the global tracking vars
  OptionsPage.currentMenuItem = menuItem;
  OptionsPage.currentSection = sectionElement;
};

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
OptionsPage.updateFeedCount = function() {
  const feedListElement = document.getElementById('feedlist');
  const count = feedListElement.childElementCount;

  const countElement = document.getElementById('subscription-count');
  if(count > 1000) {
    countElement.textContent = ' (999+)';
  } else {
    countElement.textContent = ' (' + count + ')';
  }
};

// TODO: rename, where is this appending?
OptionsPage.appendFeed = function(feed, insertedSort) {
  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);
  item.setAttribute('title', HTMLUtils.replaceTags(feed.description) || '');
  item.onclick = OptionsPage.feedListOnItemClick;

  var favIconElement = document.createElement('img');
  favIconElement.src = utils.getFavIconURLString(feed.link);
  if(feed.title) {
    favIconElement.title = feed.title;
  }
  item.appendChild(favIconElement);

  const title = document.createElement('span');
  title.textContent = utils.string.truncate(feed.title,300) || 'Untitled';
  item.appendChild(title);

  const feedListElement = document.getElementById('feedlist');

  if(insertedSort) {
    const currentItems = feedListElement.childNodes;
    var added = false;

    for(var i = 0, len = currentItems.length, currentKey; i < len; i++) {
      currentKey = currentItems[i].getAttribute('sort-key');
      if(indexedDB.cmp(feed.title || '', currentKey || '') < 0) {
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
};

OptionsPage.enableSubscriptionPreviewOnChange = function() {
  if(this.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
};

OptionsPage.showSubscriptionPreview = function(url) {
  OptionsPage.hideSubscriptionPreview();
  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    OptionsPage.startSubscription(url);
    return;
  }

  if(!navigator.onLine) {
    OptionsPage.startSubscription(url);
    return;
  }

  const previewElement = document.getElementById('subscription-preview');
  OptionsPage.showElement(previewElement);
  const progressElement = document.getElementById(
    'subscription-preview-load-progress');
  OptionsPage.showElement(progressElement);

  // TODO: check if already subscribed before preview?

  const fetchFeedTimeout = 10 * 1000;
  fetchFeed(url, fetchFeedTimeout, onFetch);

  function onFetch(event, result) {
    if(event) {
      console.dir(event);
      OptionsPage.hideSubscriptionPreview();
      OptionsPage.showErrorMessage('Unable to fetch' + url);
      return;
    }

    const progressElement = document.getElementById(
      'subscription-preview-load-progress');
    OptionsPage.hideElement(progressElement);

    const titleElement = document.getElementById('subscription-preview-title');
    titleElement.textContent = result.title || 'Untitled';

    const continueButton = document.getElementById(
      'subscription-preview-continue');
    continueButton.value = result.url;

    const resultsListElement = document.getElementById(
      'subscription-preview-entries');

    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No previewable entries';
      resultsListElement.appendChild(item);
    }

    const resultLimit = Math.min(5,result.entries.length);

    for(var i = 0, entry, item, content; i < resultLimit;i++) {
      entry = result.entries[i];
      item = document.createElement('li');
      item.innerHTML = HTMLUtils.replaceTags(entry.title || '', '');
      content = document.createElement('span');
      content.innerHTML = HTMLUtils.replaceTags(entry.content || '', '');
      item.appendChild(content);
      resultsListElement.appendChild(item);
    }
  }
};

OptionsPage.hideSubscriptionPreview = function() {
  const previewElement = document.getElementById('subscription-preview');
  OptionsPage.hideElement(previewElement);
  const resultsListElement = document.getElementById(
    'subscription-preview-entries');

  // TODO: create and use dom_clear_element
  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
};

// TODO: this should be calling out to a function in subscription.js and
// delegating most of its logic to that function.

// TODO: if the parameter is a url, treat it like a URL. Wrap it in a URL
// object. This will also explicitly test validity, meaning I don't need to
// check again. In fact maybe this function should only accept a URL
// object as input.

OptionsPage.startSubscription = function(url) {
  OptionsPage.hideSubscriptionPreview();

  if(!utils.url.isURLString(url)) {
    OptionsPage.showErrorMessage('Invalid url "' + url + '".');
    return;
  }

  OptionsPage.showSubscriptionMonitor();
  OptionsPage.updateSubscriptionMonitorMessage('Subscribing...');
  db.open(on_open);

  function on_hide_monitor_show_connection_error() {
    OptionsPage.showErrorMessage(
      'An error occurred while trying to subscribe to ' + url);
  }

  function on_open(event) {
    if(event.type !== 'success') {
      console.debug(event);
      OptionsPage.hideSubscriptionMonitor(
        on_hide_monitor_show_connection_error);
      return;
    }

    const connection = event.target.result;
    const boundOnFindFeed = on_find_feed.bind(null, connection);

    // This is the only place that calls this function apparently? Strange,
    // I thought that I would also be checking this in other places.
    Feed.findByURL(connection, url, boundOnFindFeed);
  }

  function on_hide_monitor_show_exists_error() {
    OptionsPage.showErrorMessage('Already subscribed to ' + url + '.');
  }

  function on_find_feed(connection, event) {
    if(event.target.result) {
      OptionsPage.hideSubscriptionMonitor(on_hide_monitor_show_exists_error);
      return;
    }

    // TODO: call out to net function
    if(!navigator.onLine) {
      Feed.put(connection, null, {url: url}, onSubscribe);
    } else {
      const boundOnFetchFeed = on_fetch_feed.bind(null, connection);
      fetchFeed(url, 10 * 1000, boundOnFetchFeed);
    }
  }

  function on_hide_show_fetch_error() {
    OptionsPage.showErrorMessage(
      'An error occurred while trying to subscribe to ' + url);
  }

  function on_fetch_feed(connection, event, remoteFeed) {
    if(event) {
      console.dir(event);
      OptionsPage.hideSubscriptionMonitor(on_hide_show_fetch_error);
      return;
    }

    Feed.put(connection, null, remoteFeed, on_store_feed);

    function on_store_feed(newId) {
      remoteFeed.id = newId;
      on_subscribe(remoteFeed, 0, 0);
    }
  }

  function on_hide_monitor_sub_completed() {
    const subSection = document.getElementById('mi-subscriptions');
    OptionsPage.showSection(subSection);
  }

  function on_subscribe(addedFeed) {
    OptionsPage.appendFeed(addedFeed, true);
    OptionsPage.updateFeedCount();
    OptionsPage.updateSubscriptionMonitorMessage('Subscribed to ' + url);
    OptionsPage.hideSubscriptionMonitor(on_hide_monitor_sub_completed, true);

    // Show a notification
    const title = addedFeed.title || addedFeed.url;
    utils.showNotification('Subscribed to ' + title);
  }
};

// TODO: show num entries, num unread/red, etc
// TODO: react to connection error, find error
OptionsPage.populateFeedDetails = function(feedId) {
  if(!feedId) {
    console.error('Invalid feedId');
    return;
  }

  db.open(on_open_db);

  function on_open_db(event) {
    if(event.type !== 'success') {
      // TODO: show an error message?
      console.debug('Database connection error');
      return;
    }

    const connection = event.target.result;
    Feed.findById(connection, feedId, on_find_feed);
  }

  function on_find_feed(event) {
    const feed = event.target.result;
    if(!feed) {
      // TODO: show an error message?
      console.debug('No feed found for feed id:', feedId);
      return;
    }

    // Display the feed info by updating element properties
    // TODO: do I need to do additional sanitization here?

    let title = feed.title;
    title = HTMLUtils.replaceTags(title || '', '');
    if(!title) {
      title = 'Untitled';
    }

    const titleElement = document.getElementById('details-title');
    titleElement.textContent = title;

    const favIconURL = utils.getFavIconURLString(feed.url);
    const favIconElement = document.getElementById('details-favicon');
    favIconElement.setAttribute('src', favIconURL);

    const description = HTMLUtils.replaceTags(feed.description || '', '');
    const descriptionElement = document.getElementById(
      'details-feed-description');
    descriptionElement.textContent = description;

    const feedURLElement = document.getElementById('details-feed-url');
    feedURLElement.textContent = feed.url;

    const feedLinkElement = document.getElementById('details-feed-link');
    feedLinkElement.textContent = feed.link;

    const unsubscribeButton = document.getElementById('details-unsubscribe');
    unsubscribeButton.value = feed.id;
  }
};

OptionsPage.feedListOnItemClick = function(event) {
  const element = event.currentTarget;
  const feedIdString = element.getAttribute('feed');
  const feedId = parseInt(feedIdString);

  if(isNaN(feedId)) {
    console.debug('Invalid feed id:', feedIdString);
    return;
  }

  OptionsPage.populateFeedDetails(feedId);
  // TODO: These calls should really be in an async callback
  // passed to OptionsPage.populateFeedDetails
  const feedDetailsSection = document.getElementById('mi-feed-details');
  OptionsPage.showSection(feedDetailsSection);

  // Ensure the details are visible. If scrolled down when viewing large
  // list of feeds, it would otherwise not be immediately visible.
  window.scrollTo(0,0);
};

OptionsPage.onSubscriptionFormSubmit = function(event) {
  // Prevent normal form submission event
  event.preventDefault();

  const queryElement = document.getElementById('subscribe-discover-query');

  // TODO: do not use var
  // TODO: rename query to queryString for clarity

  let queryString = queryElement.value;
  queryString = queryString || '';
  queryString = queryString.trim();

  if(!queryString) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Do nothing if still searching
  const progressElement = document.getElementById('discover-in-progress');
  if(OptionsPage.isElementVisible(progressElement)) {
    return false;
  }

  // Do nothing if subscribing
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && OptionsPage.isElementVisible(subMonitor)) {
    return false;
  }

  // Clear the previous results list
  const resultsListElement = document.getElementById('discover-results-list');
  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  OptionsPage.hideElement(progressElement);

  // If the query is a url, subscribe to the url. Otherwise, use the Google
  // Feeds api to do a search for matching feeds.
  if(utils.url.isURLString(queryString)) {
    // Start subscribing
    OptionsPage.hideElement(progressElement);
    queryElement.value = '';
    OptionsPage.showSubscriptionPreview(queryString);
  } else {
    // Show search results
    OptionsPage.showElement(progressElement);
    GoogleFeedsAPI.search(queryString, 5000, OptionsPage.onDiscoverComplete);
  }

  // Indicate that the normal form submit behavior should be prevented
  return false;
};

OptionsPage.onDiscoverSubscriptionButtonClick = function(event) {
  const button = event.target;
  const url = button.value;
  if(!url) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && OptionsPage.isElementVisible(subMonitor)) {
    return;
  }

  OptionsPage.showSubscriptionPreview(url);
};

OptionsPage.onDiscoverComplete = function(errorEvent, query, results) {
  const progressElement = document.getElementById('discover-in-progress');
  const noResultsElement = document.getElementById('discover-no-results');
  const resultsList = document.getElementById('discover-results-list');

  // Define an error value if query or results are undefined
  if(!query || !results) {
    if(!errorEvent) {
      errorEvent = 'No results';
    }
  }

  // If an error occurred, hide the progress element and show an error message
  // and exit early.
  if(errorEvent) {
    console.debug('Discover feeds error:', errorEvent);
    OptionsPage.hideElement(progressElement);
    OptionsPage.showErrorMessage('An error occurred when searching for feeds: ' +
      errorEvent);
    return;
  }

  // Searching completed, hide the progress
  OptionsPage.hideElement(progressElement);

  // If there were no search results, hide the results list and show the
  // no results element and exit early.
  if(results.length < 1) {
    OptionsPage.hideElement(resultsList);
    OptionsPage.showElement(noResultsElement);
    return;
  }

  if(OptionsPage.isElementVisible(resultsList)) {
    // Clear the previous results
    resultsList.innerHTML = '';
  } else {
    OptionsPage.hideElement(noResultsElement);
    OptionsPage.showElement(resultsList);
  }

  // Add an initial count of the number of feeds as one of the feed list items
  const listItem = document.createElement('li');
  // TODO: consider using Javascript's new template feature here
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  // Generate an array of result elements to append
  const resultElements = results.map(OptionsPage.createSearchResult);

  for(let i = 0, len = resultElements.length; i < len; i++) {
    resultsList.appendChild(resultElements[i]);
  }
};

OptionsPage.createSearchResult = function(result) {
  const item = document.createElement('li');

  // Create the subscribe button for the result
  const button = document.createElement('button');
  button.value = result.url;
  button.title = result.url;
  button.textContent = 'Subscribe';
  button.onclick = OptionsPage.onDiscoverSubscriptionButtonClick;
  item.appendChild(button);

  // Show the feed's favicon
  const image = document.createElement('img');
  image.setAttribute('src', utils.getFavIconURLString(result.url));
  image.title = result.link;
  item.appendChild(image);

  // Show the feeds title
  const a = document.createElement('a');
  a.setAttribute('href', result.link);
  a.setAttribute('target', '_blank');
  a.title = result.title;
  a.innerHTML = result.title;
  item.appendChild(a);

  // Show the feed's description
  const snippetSpan = document.createElement('span');
  snippetSpan.innerHTML = result.contentSnippet;
  item.appendChild(snippetSpan);

  // Show the feed's url
  const span = document.createElement('span');
  span.setAttribute('class', 'discover-search-result-url');
  span.textContent = result.url;
  item.appendChild(span);

  return item;
};

OptionsPage.onUnsubscribeClick = function(event) {
  const unsubscribeButton = event.target;
  const feedIdString = button.value;
  const feedId = parseInt(feedIdString, 10);

  if(!feedId || isNaN(feedId)) {
    console.error('Invalid feed id:', feedIdString);
    return;
  }

  SubscriptionManager.unsubscribe(feedId, OptionsPage.onUnsubscribe);
};

// TODO: do i react to the cross-window message event, or do I react
// to the immediate callback?
OptionsPage.onUnsubscribe = function(event) {
  if(event.type === 'error') {
    // TODO: show an error message
    console.debug(event);
    return;
  }

  // Remove the feed from the subscription list
  const selector = 'feedlist li[feed="' + feedId + '"]';
  const feedElement = document.querySelector(selector);
  if(item) {
    feedElement.removeEventListener('click',
      OptionsPage.feedListOnItemClick);
    feedElement.remove();
  }

  OptionsPage.updateFeedCount();

  // If the feed list has no items, hide it and show a message instead
  const feedListElement = document.getElementById('feedlist');
  const noFeedsElement = document.getElementById('nosubscriptions');
  if(feedListElement.childElementCount === 0) {
    OptionsPage.hideElement(feedListElement);
    OptionsPage.showElement(noFeedsElement);
  }

  // Switch to the main view
  const sectionMenu = document.getElementById('mi-subscriptions');
  OptionsPage.showSection(sectionMenu);
};

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error parsing the OPML
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.
// TODO: switch to a different section of the options ui on complete?
OptionsPage.importOPMLButtonOnClick = function(event) {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  OptionsPage.hideElement(uploader);
  uploader.onchange = on_uploader_change;
  document.body.appendChild(uploader);
  uploader.click();

  function on_uploader_change(event) {

    uploader.removeEventListener('change', on_uploader_change);

    if(!uploader.files || !uploader.files.length) {
      on_import_completed();
      return;
    }

    db.open(on_open);
  }

  function on_open(event) {

    if(event.type !== 'success') {
      // TODO: show an error message
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    OPML.importFiles(connection, uploader.files, on_import_completed);
  }

  function on_import_completed(tracker) {
    uploader.remove();

    // TODO: remove this after some more testing, this should never happen
    if(!tracker) {
      console.debug('OPML import error, undefined stats tracker');
      return;
    }

    const errors = tracker.errors;

    if(errors && errors.length) {
      // TODO: show an error message
      console.debug('Encountered exceptions when importing: %o', errors);
    }

    // TODO: utils.showNotification because opml import no longer does this
    // itself
    // TODO: the importer should be the one responsible for sending the
    // notification, not here
    // TODO: log additional information, like the number of feeds
    // found and number actually added
    console.info('Completed opml import, imported %s of %s files',
      tracker.filesImported, tracker.numFiles);
  }
};

// TODO: move the helper functions back into this function as nested functions
OptionsPage.exportOPMLButtonOnClick = function(event) {
  db.open(OptionsPage.exportOPMLOnOpen);
};

OptionsPage.exportOPMLOnOpen = function(event) {
  if(event.type !== 'success') {
    // TODO: visually report the error
    console.debug('Failed to connect to database when exporting opml');
    return;
  }

  const connection = event.target.result;
  Feed.getAll(connection, OptionsPage.exportOPMLOnGetFeeds);
};

OptionsPage.exportOPMLOnGetFeeds = function(feeds) {
  const title = 'Subscriptions';
  const doc = OPML.createDocument(title, feeds);

  // TODO: should should probably be delegating something to a function
  // in xml.js
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

  // Cleanup
  URL.revokeObjectURL(objectURL);
  anchor.remove();

  console.debug('Completed exporting %s feeds to opml file %s',
    doc.querySelectorAll('outline').length, fileName);
  // TODO: show a message?
};

OptionsPage.enableURLRewritingCheckboxOnChange = function(event) {
  const checkboxElement = event.target;
  if(checkboxElement.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
  }
};

OptionsPage.headerFontMenuOnChange = function(event){
  if(event.target.value)
    localStorage.HEADER_FONT_FAMILY = event.target.value;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.headerFontSizeOnChange = function(event) {
  localStorage.HEADER_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.bodyFontMenuOnChange = function(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.columnCountMenuOnChange = function(event) {
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.bodyFontSizeOnChange = function(event) {
  localStorage.BODY_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.bodyLineHeightSliderOnChange = function(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.marginOnChange = function(event) {
  localStorage.ENTRY_MARGIN = parseInt(event.target.value) || 10;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.backgroundImageOnChange = function(event) {
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.justifyTextCheckboxOnChange = function(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
};

OptionsPage.enableNotificationsCheckboxOnChange = function(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['notifications']}, function() {});
  else
    chrome.permissions.remove({permissions:['notifications']}, function() {});
};

OptionsPage.enableBackgroundProcessingCheckboxOnChange = function(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['background']}, function() {});
  else
    chrome.permissions.remove({permissions:['background']}, function() {});
};

OptionsPage.enableIdleCheckCheckboxOnChange = function(event) {
  if(event.target.checked)
    chrome.permissions.request({permissions:['idle']}, function(){});
  else
    chrome.permissions.remove({permissions:['idle']}, function(){});
};

OptionsPage.onNavigationMenuFeedItemClick = function(event) {
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  OptionsPage.showSection(event.currentTarget);
};

OptionsPage.initSubscriptionsSection = function() {
  let feedCount = 0;

  db.open(on_open);

  function on_open(event) {
    if(event.type !== 'success') {
      // TODO: react
      console.debug(event);
      return;
    }

    Feed.forEach(event.target.result, process_feed, true,
      on_feeds_iterated);
  }

  function process_feed(feed) {
    feedCount++;
    OptionsPage.appendFeed(feed);
    OptionsPage.updateFeedCount();
  }

  function on_feeds_iterated() {
    const noFeedsElement = document.getElementById('nosubscriptions');
    const feedListElement = document.getElementById('feedlist');
    if(feedCount === 0) {
      OptionsPage.showElement(noFeedsElement);
      OptionsPage.hideElement(feedListElement);
    } else {
      OptionsPage.hideElement(noFeedsElement);
      OptionsPage.showElement(feedListElement);
    }
  }
};

OptionsPage.onDOMContentLoaded = function(event) {
  // Avoid attempts to re-init
  document.removeEventListener('DOMContentLoaded',
    OptionsPage.onDOMContentLoaded);

  // Call out to load styles because this affects the feed settings preview
  // area in the display settings section
  DisplaySettings.loadStyles();

  // Conditionally show/hide the Allow embeds option in the left menu
  // TODO: if I am not even supporting the embed option anymore, why
  // is this still here?
  const navEmbedItem = document.getElementById('mi-embeds');
  const isAskPolicy = localStorage.EMBED_POLICY === 'ask';
  if(isAskPolicy) {
    OptionsPage.showElement(navEmbedItem);
  } else {
    OptionsPage.hideElement(navEmbedItem);
  }

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const navFeedItems = document.querySelectorAll('#navigation-menu li');
  for(let i = 0, len = navFeedItems.length; i < len; i++) {
    navFeedItems[i].onclick = OptionsPage.onNavigationMenuFeedItemClick;
  }

  // Init the general settings page
  const enableNotificationsCheckbox = document.getElementById(
    'enable-notifications');
  enableNotificationsCheckbox.onclick =
    OptionsPage.enableNotificationsCheckboxOnChange;

  function has_notifications_permission(permitted) {
    enableNotificationsCheckbox.checked = permitted;
  }

  const notificationsPermissionQuery = {'permissions': ['notifications']};
  chrome.permissions.contains(notificationsPermissionQuery,
    has_notifications_permission);

  document.getElementById('enable-background').onclick =
    OptionsPage.enableBackgroundProcessingCheckboxOnChange;

  chrome.permissions.contains({permissions:['background']},
    function has_run_in_background_permission(permitted) {
    document.getElementById('enable-background').checked = permitted;
  });

  document.getElementById('enable-idle-check').onclick =
    OptionsPage.enableIdleCheckCheckboxOnChange;

  chrome.permissions.contains({permissions:['idle']},
    function has_check_idle_permission(permitted) {
    document.getElementById('enable-idle-check').checked = permitted;
  });

  document.getElementById('enable-subscription-preview').checked =
    !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  document.getElementById('enable-subscription-preview').onchange =
    OptionsPage.enableSubscriptionPreviewOnChange;
  document.getElementById('rewriting-enable').checked =
    !!localStorage.URL_REWRITING_ENABLED;
  document.getElementById('rewriting-enable').onchange =
    OptionsPage.enableURLRewritingCheckboxOnChange;

  // Init the opml import/export buttons
  document.getElementById('button-export-opml').onclick =
    OptionsPage.exportOPMLButtonOnClick;
  document.getElementById('button-import-opml').onclick =
    OptionsPage.importOPMLButtonOnClick;

  OptionsPage.initSubscriptionsSection();

  // Init feed details section unsubscribe button click handler
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = OptionsPage.onUnsubscribeClick;

  // Init the subscription form section
  document.getElementById('subscription-form').onsubmit =
    OptionsPage.onSubscriptionFormSubmit;
  document.getElementById('subscription-preview-continue').onclick =
    function on_preview_continue_click(event) {
    const url = event.currentTarget.value;
    OptionsPage.hideSubscriptionPreview();
    OptionsPage.startSubscription(url);
  };

  // Init display settings
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  document.getElementById('entry-background-image').appendChild(option);

  DisplaySettings.BACKGROUND_IMAGE_PATHS.forEach(
    function append_bgimage_option(path) {
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/images/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE == path;
    document.getElementById('entry-background-image').appendChild(option);
  });

  document.getElementById('entry-background-image').onchange =
    OptionsPage.backgroundImageOnChange;

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_body_font').appendChild(option);

  DisplaySettings.FONT_FAMILIES.forEach(
    function append_header_font_option(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  });

  DisplaySettings.FONT_FAMILIES.forEach(
    function append_body_font_option(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_body_font').appendChild(option);
  });

  document.getElementById('select_header_font').onchange =
    OptionsPage.headerFontMenuOnChange;
  document.getElementById('select_body_font').onchange =
    OptionsPage.bodyFontMenuOnChange;

  [1,2,3].forEach(function append_col_count_option(columnCount) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    document.getElementById('column-count').appendChild(option);
  });

  document.getElementById('column-count').onchange =
    OptionsPage.columnCountMenuOnChange;

  var inputChangedTimer, inputChangedDelay = 400;

  document.getElementById('entry-background-color').value =
    localStorage.ENTRY_BACKGROUND_COLOR || '';
  document.getElementById('entry-background-color').oninput = function() {
    if(event.target.value)
      localStorage.ENTRY_BACKGROUND_COLOR = event.target.value;
    else
      delete localStorage.ENTRY_BACKGROUND_COLOR;
    chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
  };

  document.getElementById('entry-margin').value =
    parseInt(localStorage.ENTRY_MARGIN) || '10';
  document.getElementById('entry-margin').onchange =
    OptionsPage.marginOnChange;
  document.getElementById('header-font-size').value =
    parseInt(localStorage.HEADER_FONT_SIZE) || '1';
  document.getElementById('header-font-size').onchange =
    OptionsPage.headerFontSizeOnChange;
  document.getElementById('body-font-size').value =
    parseInt(localStorage.BODY_FONT_SIZE) || '1';
  document.getElementById('body-font-size').onchange =
    OptionsPage.bodyFontSizeOnChange;
  document.getElementById('justify-text').checked =
    (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  document.getElementById('justify-text').onchange =
    OptionsPage.justifyTextCheckboxOnChange;
  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  document.getElementById('body-line-height').value =
    (bodyLineHeight / 10).toFixed(2);
  document.getElementById('body-line-height').oninput =
    OptionsPage.bodyLineHeightSliderOnChange;


  // Init the about section
  const manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name || '';
  document.getElementById('extension-version').textContent =
    manifest.version || '';
  document.getElementById('extension-author').textContent =
    manifest.author || '';
  document.getElementById('extension-description').textContent =
    manifest.description || '';
  document.getElementById('extension-homepage').textContent =
    manifest.homepage_url || '';

  // Initially show the subscriptions list
  OptionsPage.showSection(document.getElementById('mi-subscriptions'));
};

document.addEventListener('DOMContentLoaded', OptionsPage.onDOMContentLoaded);
