// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

// TODO: remove the subscription preview feature

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

// TODO: rename to fadeOutSubscriptionMonitor to clarify it is async?
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
  const countElement = document.getElementById('subscription-count');
  const count = feedListElement.childElementCount;
  if(count > 1000) {
    countElement.textContent = ' (999+)';
  } else {
    countElement.textContent = ' (' + count + ')';
  }
};

// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
OptionsPage.appendFeed = function(feed, insertedSort) {
  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);
  item.setAttribute('title', replaceHTML(feed.description) || '');
  item.onclick = OptionsPage.feedListOnItemClick;

  var favIconElement = document.createElement('img');

  // I don't know if this was loaded from database or from fetchFeed, so
  // I think it could be either one?
  if(feed.link) {
    if(Object.prototype.toString.call(feed.link) === '[object URL]') {
      console.debug('feed.link is a URL');
      favIconElement.src = getFavIconURL(feed.link).href;
    } else {
      console.debug('feed.link is a String');
      favIconElement.src = getFavIconURL(new URL(feed.link)).href;
    }
  }

  if(feed.title) {
    favIconElement.title = feed.title;
  }
  item.appendChild(favIconElement);

  const title = document.createElement('span');

  // TODO: the title may contain html and other stuff, it needs to be
  // more properly sanitized
  title.textContent = utils.string.truncate(feed.title, 300) || 'Untitled';
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

// TODO: deprecate the ability to preview
// TODO: check if already subscribed before preview?
// TODO: rename url to something like feedURL, it's not just any url
OptionsPage.showSubscriptionPreview = function(url) {

  OptionsPage.hideSubscriptionPreview();

  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    OptionsPage.startSubscription(url);
    return;
  }

  // TODO: this check no longer makes sense, must be online in order to
  // subscribe because I removed the ability to subscribe while offline
  if('onLine' in navigator && !navigator.onLine) {
    OptionsPage.startSubscription(url);
    return;
  }

  const previewElement = document.getElementById('subscription-preview');
  OptionsPage.showElement(previewElement);
  const progressElement = document.getElementById(
    'subscription-preview-load-progress');
  OptionsPage.showElement(progressElement);

  const fetchTimeoutMills = 10 * 1000;
  const excludeEntries = false;
  fetchFeed(url, fetchTimeoutMills, excludeEntries, onFetch);

  function onFetch(fetchEvent) {
    if(event.type !== 'load') {
      console.dir(event);
      OptionsPage.hideSubscriptionPreview();
      // NOTE: because of concatenate this implicitly converts url to string
      // which is fine
      OptionsPage.showErrorMessage('Unable to fetch' + url);
      return;
    }

    const progressElement = document.getElementById(
      'subscription-preview-load-progress');
    OptionsPage.hideElement(progressElement);

    const feed = fetchEvent.feed;
    const titleElement = document.getElementById('subscription-preview-title');
    titleElement.textContent = feed.title || 'Untitled';

    // Fetch feed generates an array of URL objects. Use the last one in the
    // list as the button's value.
    const continueButton = document.getElementById(
      'subscription-preview-continue');
    const finalFeedURL = feed.urls[feed.urls.length - 1];
    continueButton.value = finalFeedURL.href;

    const resultsListElement = document.getElementById(
      'subscription-preview-entries');

    if(!feed.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No previewable entries';
      resultsListElement.appendChild(item);
    }

    const resultLimit = Math.min(5,feed.entries.length);
    for(let i = 0, entry, item, content; i < resultLimit; i++) {
      entry = feed.entries[i];
      item = document.createElement('li');
      item.innerHTML = replaceHTML(entry.title || '', '');
      content = document.createElement('span');
      content.innerHTML = replaceHTML(entry.content || '', '');
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
  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
};

// NOTE: This now expects a URL object
OptionsPage.startSubscription = function(url) {
  OptionsPage.hideSubscriptionPreview();
  OptionsPage.showSubscriptionMonitor();
  OptionsPage.updateSubscriptionMonitorMessage('Subscribing to' + url.href);
  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      OptionsPage.hideSubscriptionMonitor(function() {
        OptionsPage.showErrorMessage('Unable to connect to database');
      });
      return;
    }

    const connection = event.target.result;
    Subscription.add(connection, url, onSubscribe);
  }

  function onSubscribe(event) {
    if(event.type !== 'success') {
      OptionsPage.hideSubscriptionMonitor(function() {
        OptionsPage.showErrorMessage(event.message);
      });
      return;
    }

    // NOTE: the feed in added feed is the serializable feed object, which is
    // different than the type of field yielded by fetchFeed. For example,
    // the added feed's urls array contains strings, not URL objects.

    const addedFeed = event.feed;
    OptionsPage.appendFeed(addedFeed, true);
    OptionsPage.updateFeedCount();
    OptionsPage.updateSubscriptionMonitorMessage('Subscribed to ' + url);

    // Hide the sub monitor then switch back to the main feed list
    OptionsPage.hideSubscriptionMonitor(function() {
      const subSection = document.getElementById('mi-subscriptions');
      OptionsPage.showSection(subSection);
    }, true);
  }
};

// TODO: show num entries, num unread/red, etc
// TODO: react to connection error, find error
OptionsPage.populateFeedDetails = function(feedId) {
  if(!feedId) {
    console.error('Invalid feedId');
    return;
  }

  db.open(onOpen);

  function onOpen(event) {
    if(event.type !== 'success') {
      // TODO: show an error message?
      console.debug('Database connection error');
      return;
    }

    // Lookup the feed by its id
    const connection = event.target.result;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = onFindFeedById;
  }

  function onFindFeedById(event) {
    const feed = event.target.result;
    if(!feed) {
      // TODO: show an error message?
      console.debug('No feed found for feed id:', feedId);
      return;
    }

    // Display the feed info by updating element properties
    // TODO: do I need to do additional sanitization here?

    let title = feed.title;
    title = replaceHTML(title || '', '');
    if(!title) {
      title = 'Untitled';
    }

    const titleElement = document.getElementById('details-title');
    titleElement.textContent = title;

    // Because the feed was loaded directly from the database, it contains
    // strings, not url objects.
    const feedURLString = feed.urls[feed.urls.length - 1];
    const feedURL = new URL(feedURLString);

    const favIconElement = document.getElementById('details-favicon');
    const favIconURL = getFavIconURL(feedURL);
    favIconElement.setAttribute('src', favIconURL.href);

    const description = replaceHTML(feed.description || '', '');
    const descriptionElement = document.getElementById(
      'details-feed-description');
    descriptionElement.textContent = description;

    const feedURLElement = document.getElementById('details-feed-url');
    feedURLElement.textContent = feedURL.href;

    const feedLinkElement = document.getElementById('details-feed-link');
    // Because the feed was loaded directly from the database, feed.link
    // is a string
    const feedLinkURLString = feed.link;
    feedLinkElement.textContent = feedLinkURLString;

    const unsubscribeButton = document.getElementById('details-unsubscribe');
    unsubscribeButton.value = '' + feed.id;
  }
};

OptionsPage.feedListOnItemClick = function(event) {
  const element = event.currentTarget;
  const feedIdString = element.getAttribute('feed');
  const feedId = parseInt(feedIdString, 10);

  if(isNaN(feedId)) {
    console.debug('Invalid feed id:', feedIdString);
    // TODO: react to this error
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
  // Prevent normal form submission behavior
  event.preventDefault();

  const queryElement = document.getElementById('subscribe-discover-query');
  let queryString = queryElement.value;
  queryString = queryString || '';
  queryString = queryString.trim();

  if(!queryString) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Do nothing if searching in progress
  const progressElement = document.getElementById('discover-in-progress');
  if(OptionsPage.isElementVisible(progressElement)) {
    return false;
  }

  // Do nothing if subscription in progress
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

  let url = null;
  try {
    url = new URL(queryString);
  } catch(exception) {}

  // If it is a URL, subscribe, otherwise, search
  if(url) {
    OptionsPage.hideElement(progressElement);
    queryElement.value = '';
    OptionsPage.showSubscriptionPreview(url);
  } else {
    // Show search results
    OptionsPage.showElement(progressElement);
    GoogleFeedsAPI.search(queryString, 5000, OptionsPage.onDiscoverComplete);
  }

  // Indicate that the normal form submit behavior should be prevented
  return false;
};

OptionsPage.onDiscoverSubscriptionButtonClick = function(event) {

  const buttonSubscribe = event.target;
  const feedURLString = buttonSubscribe.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feedURLString) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && OptionsPage.isElementVisible(subMonitor)) {
    return;
  }

  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feedURL = new URL(feedURLString);
  // TODO: I plan to deprecate the preview step, so this should probably be
  // making a call directly to the step that starts the subscription process.
  OptionsPage.showSubscriptionPreview(feedURL);
};

OptionsPage.onDiscoverComplete = function(event) {

  const query = event.queryString;
  const results = event.entries;

  const progressElement = document.getElementById('discover-in-progress');
  const noResultsElement = document.getElementById('discover-no-results');
  const resultsList = document.getElementById('discover-results-list');

  // If an error occurred, hide the progress element and show an error message
  // and exit early.
  if(event.type !== 'load') {
    console.debug(event);
    OptionsPage.hideElement(progressElement);
    OptionsPage.showErrorMessage(
      'An error occurred when searching for feeds: ' + event);
    return;
  }

  // Searching completed, hide the progress
  OptionsPage.hideElement(progressElement);

  // If there were no search results, hide the results list and show the
  // no results element and exit early.
  // TODO: is < 1 really the best test? Wouldn't !results.length be more
  // appropriate and simpler?
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

  // Append the result elements
  for(let i = 0, len = resultElements.length; i < len; i++) {
    resultsList.appendChild(resultElements[i]);
  }
};

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
OptionsPage.createSearchResult = function(feedResult) {
  const item = document.createElement('li');

  // NOTE: feedResult.url is a URL object, not a string
  // TODO: feedResult.link is currently a string, change google-feeds.js to
  // provide a URL object

  const buttonSubscribe = document.createElement('button');
  buttonSubscribe.value = feedResult.url.href;
  buttonSubscribe.title = feedResult.url.href;
  buttonSubscribe.textContent = 'Subscribe';
  buttonSubscribe.onclick = OptionsPage.onDiscoverSubscriptionButtonClick;
  item.appendChild(buttonSubscribe);

  const imageFavIcon = document.createElement('img');
  imageFavIcon.setAttribute('src', getFavIconURL(feedResult.url).href);
  if(feedResult.link) {
    imageFavIcon.title = result.link;
  }
  item.appendChild(imageFavIcon);

  // TODO: don't allow for empty href value
  const anchorTitle = document.createElement('a');
  if(feedResult.link) {
    anchorTitle.setAttribute('href', feedResult.link);
  }
  anchorTitle.setAttribute('target', '_blank');
  anchorTitle.title = feedResult.title;
  anchorTitle.innerHTML = feedResult.title;
  item.appendChild(anchorTitle);

  const spanSnippet = document.createElement('span');
  spanSnippet.innerHTML = feedResult.contentSnippet;
  item.appendChild(spanSnippet);

  const spanURL = document.createElement('span');
  spanURL.setAttribute('class', 'discover-search-result-url');
  spanURL.textContent = feedResult.url.href;
  item.appendChild(spanURL);

  return item;
};

OptionsPage.buttonUnsubscribeOnClick = function(event) {
  // Start by getting the feed id. Whenevever I load the feed details page,
  // I set the button's value to the feed id, so get it from there.
  const buttonUnsubscribe = event.target;
  const feedIdString = buttonUnsubscribe.value;
  const feedId = parseInt(feedIdString, 10);

  // Verify that we have a valid feed id. This check is largely the result of
  // an earlier bug I was experiencing, and probably isn't that necessary, but
  // I think it is harmless for now.
  if(!feedId || isNaN(feedId)) {
    // TODO: show an error
    console.error('Invalid feed id:', feedIdString);
    return;
  }

  // NOTE: I have the option of reacting to the cross-window message that
  // is sent by the unsubscribe function instead of the callback, but it is
  // obviously faster and more local to use the callback, so I chose to go with
  // that. I am not entirely confident this is the best decision.

  Subscription.remove(feedId, OptionsPage.onUnsubscribe);

  function onUnsubscribe(event) {
    // If there was some failure to unsubscribe from the feed, react here
    // and then exit early and do not update the UI
    // TODO: show an error message about how there was a problem unsubscribing
    if(event.type === 'error') {
      console.debug(event);
      return;
    }

    // Remove the feed from the subscription list
    // TODO: getting the feed element from the menu should be more idiomatic,
    // I should probably be using a function here. That, or the function I
    // create that removes the feed accepts a feedId parameter and knows how
    // to get it there.
    // TODO: removing the feed element from the menu should also probably be
    // more idiomatic and use a function
    const selector = 'feedlist li[feed="' + feedId + '"]';
    const feedElement = document.querySelector(selector);
    if(item) {
      feedElement.removeEventListener('click',
        OptionsPage.feedListOnItemClick);
      feedElement.remove();
    }

    // Upon removing the feed, update the displayed number of feeds.
    // TODO: this should probably be baked into the function that removes the
    // feed or some function that handles changes to the feed list, so that
    // I do not need to call it explicitly and do not risk forgetting not to
    // call it.
    OptionsPage.updateFeedCount();

    // Upon removing the feed, update the state of the feed list.
    // If the feed list has no items, hide it and show a message instead
    // TODO: this should probably also be baked into the function that removes
    // the feed from the feed list and not the responsibility of the
    // unsubscribe function.
    const feedListElement = document.getElementById('feedlist');
    const noFeedsElement = document.getElementById('nosubscriptions');
    if(feedListElement.childElementCount === 0) {
      OptionsPage.hideElement(feedListElement);
      OptionsPage.showElement(noFeedsElement);
    }

    // Switch back to the main view
    const sectionMenu = document.getElementById('mi-subscriptions');
    OptionsPage.showSection(sectionMenu);
  }
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
  uploader.onchange = onUploaderChange;
  document.body.appendChild(uploader);
  uploader.click();

  function onUploaderChange(event) {
    uploader.removeEventListener('change', onUploaderChange);
    if(!uploader.files || !uploader.files.length) {
      onImportCompleted();
      return;
    }
    db.open(onOpen);
  }

  function onOpen(event) {
    if(event.type !== 'success') {
      // TODO: show an error message
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    OPML.importFiles(connection, uploader.files, onImportCompleted);
  }

  function onImportCompleted() {
    uploader.remove();
    console.info('Completed opml import');
  }
};

OptionsPage.exportOPMLButtonOnClick = function(event) {
  const feeds = [];

  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      // TODO: visually report the error
      console.debug('Failed to connect to database when exporting opml');
      return;
    }

    // Query for all feeds in the feed store
    const connection = event.target.result;
    const transaction = connection.transaction('feed');
    transaction.oncomplete = onGetFeeds;
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = onGetNextFeed;
  };

  // Append the feed at the cursor to the feeds array
  function onGetNextFeed(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    }
  }

  function onGetFeeds() {
    const title = 'Subscriptions';
    const doc = OPML.createDocument(title, feeds);
    const writer = new XMLSerializer();
    const serializedString = writer.serializeToString(doc);

    const blobFormat = {'type': 'application/xml'};
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

    // TODO: show a message? An alert? Something?
  };
};

OptionsPage.initSubscriptionsSection = function() {
  let feedCount = 0;
  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      // TODO: react to error
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('feed');
    transaction.oncomplete = onFeedsIterated;
    const store = transaction.objectStore('feed');
    const index = store.index('title');
    const request = index.openCursor();
    request.onsuccess = onGetNextFeed;
  }

  function onGetNextFeed(event) {
    const cursor = event.target.result;
    if(cursor) {
      const feed = cursor.value;
      feedCount++;
      // NOTE: this is calling append feed with a feed object loaded directly
      // from the database, which is diferent than the results of fetchFeed
      OptionsPage.appendFeed(feed);
      OptionsPage.updateFeedCount();
      cursor.continue();
    }
  }

  function onFeedsIterated() {
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

  // Init CSS styles that affect the display preview area
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
    navFeedItems[i].onclick = onNavigationMenuFeedItemClick;
  }

  // Upon clicking a feed in the feed list, switch to showing the details
  // of that feed
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the desired target
  // TODO: rather than comment, use a local variable here to clarify why
  // currentTarget is more appropriate
  function onNavigationMenuFeedItemClick(event) {
    OptionsPage.showSection(event.currentTarget);
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const checkboxEnableNotifications = document.getElementById(
    'enable-notifications');
  checkboxEnableNotifications.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  checkboxEnableNotifications.onclick = checkboxEnableNotificationsOnChange;
  function checkboxEnableNotificationsOnChange(event) {
    if(event.target.checked) {
      localStorage.SHOW_NOTIFICATIONS = '1';
    } else {
      delete localStorage.SHOW_NOTIFICATIONS;
    }
  }

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.
  // TODO: should this be onchange or onclick? I had previously named the
  // function onchange but was listening to onclick
  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API ?
  const checkboxEnableBackgroundProcessing = document.getElementById(
    'enable-background');
  checkboxEnableBackgroundProcessing.onclick =
    checkboxEnableBackgroundProcessingOnClick;
  function checkboxEnableBackgroundProcessingOnClick(event) {
    if(event.target.checked) {
      chrome.permissions.request({'permissions': ['background']},
        noopCallback);
    }
    else {
      chrome.permissions.remove({'permissions': ['background']}, noopCallback);
    }

    function noopCallback() {}
  }
  chrome.permissions.contains({'permissions': ['background']},
    onCheckHasRunInBackgroundPermission);
  function onCheckHasRunInBackgroundPermission(permitted) {
    checkboxEnableBackgroundProcessing.checked = permitted;
  }

  const checkboxEnableIdleCheck = document.getElementById('enable-idle-check');
  checkboxEnableIdleCheck.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
  checkboxEnableIdleCheck.onclick = checkboxEnableIdleCheckOnChange;
  function checkboxEnableIdleCheckOnChange(event) {
    if(event.target.checked) {
      localStorage.ONLY_POLL_IF_IDLE = '1';
    } else {
      delete localStorage.ONLY_POLL_IF_IDLE;
    }
  }

  // TODO: deprecate this because I plan to deprecate the preview ability.
  const checkboxEnableSubscriptionPreview =
    document.getElementById('enable-subscription-preview');
  checkboxEnableSubscriptionPreview.checked =
    'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  checkboxEnableSubscriptionPreview.onchange =
    checkboxEnableSubscriptionPreviewOnChange;
  function checkboxEnableSubscriptionPreviewOnChange(event) {
    if(this.checked) {
      localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
    } else {
      delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
    }
  }

  // TODO: deprecate this, url rewriting is always enabled
  const checkboxEnableURLRewriting = document.getElementById(
    'rewriting-enable');
  checkboxEnableURLRewriting.checked = 'URL_REWRITING_ENABLED' in localStorage;
  checkboxEnableURLRewriting.onchange = enableURLRewritingCheckboxOnChange;
  function enableURLRewritingCheckboxOnChange(event) {
    if(checkboxEnableURLRewriting.checked) {
      localStorage.URL_REWRITING_ENABLED = '1';
    } else {
      delete localStorage.URL_REWRITING_ENABLED;
    }
  }

  // Init the opml import/export buttons
  const buttonExportOPML = document.getElementById('button-export-opml');
  buttonExportOPML.onclick = OptionsPage.exportOPMLButtonOnClick;
  const buttonImportOPML = document.getElementById('button-import-opml');
  buttonImportOPML.onclick = OptionsPage.importOPMLButtonOnClick;

  OptionsPage.initSubscriptionsSection();

  // Init feed details section unsubscribe button click handler
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = OptionsPage.buttonUnsubscribeOnClick;

  // Init the subscription form section
  const formSubscribe = document.getElementById('subscription-form');
  formSubscribe.onsubmit = OptionsPage.onSubscriptionFormSubmit;
  const buttonSubscriptionPreviewContinue = document.getElementById(
    'subscription-preview-continue');
  buttonSubscriptionPreviewContinue.onclick =
    buttonSubscriptionPreviewContinueOnClick;

  function buttonSubscriptionPreviewContinueOnClick(event) {
    const urlString = event.currentTarget.value;
    OptionsPage.hideSubscriptionPreview();

    if(!urlString) {
      console.debug('no url');
      return;
    }

    const feedURL = new URL(urlString);
    OptionsPage.startSubscription(feedURL);
  }

  // Init display settings

  // Setup the entry background image menu
  const menuEntryBackgroundImage = document.getElementById(
    'entry-background-image');
  menuEntryBackgroundImage.onchange = menuEntryBackgroundImageOnChange;

  function menuEntryBackgroundImageOnChange(event) {
    if(event.target.value) {
      localStorage.BACKGROUND_IMAGE = event.target.value;
    } else {
      delete localStorage.BACKGROUND_IMAGE;
    }

    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // TODO: stop trying to reuse the option variable, just create separate
  // variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  menuEntryBackgroundImage.appendChild(option);

  // Load and append the various background images into the menu. Set the
  // selected option.
  // TODO: this shouldn't read from the local storage variable per call
  DisplaySettings.BACKGROUND_IMAGE_PATHS.forEach(appendBackgroundImageOption);
  function appendBackgroundImageOption(path) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/images/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE === path;
    menuEntryBackgroundImage.appendChild(option);
  }

  // Setup the header font menu
  const menuHeaderFont = document.getElementById('select_header_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  // TODO: use a basic for loop
  DisplaySettings.FONT_FAMILIES.forEach(appendHeaderFontOption);
  function appendHeaderFontOption(fontFamily) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  }
  menuHeaderFont.onchange = headerFontMenuOnChange;
  function headerFontMenuOnChange(event){
    if(event.target.value) {
      localStorage.HEADER_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.HEADER_FONT_FAMILY;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // Setup the body font menu
  const menuBodyFont = document.getElementById('select_body_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  menuBodyFont.appendChild(option);
  // TODO: use a basic for loop
  DisplaySettings.FONT_FAMILIES.forEach(appendBodyFontOption);

  function appendBodyFontOption(fontFamily) {
    // TODO: use a local variable for option
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    menuBodyFont.appendChild(option);
  }
  menuBodyFont.onchange = bodyFontMenuOnChange;
  function bodyFontMenuOnChange(event) {
    if(event.target.value) {
      localStorage.BODY_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.BODY_FONT_FAMILY;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const columnCountElement = document.getElementById('column-count');

  // TODO: use a basic for loop here
  ['1','2','3'].forEach(appendColumnCountOption);

  function appendColumnCountOption(columnCount) {
    // TODO: use a local variable here
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    columnCountElement.appendChild(option);
  }

  columnCountElement.onchange = columnCountMenuOnChange;

  function columnCountMenuOnChange(event) {
    if(event.target.value) {
      localStorage.COLUMN_COUNT = event.target.value;
    } else {
      delete localStorage.COLUMN_COUNT;
    }

    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const entryBackgroundColorElement = document.getElementById(
    'entry-background-color');
  entryBackgroundColorElement.value = localStorage.ENTRY_BACKGROUND_COLOR ||
    '';
  entryBackgroundColorElement.oninput = backgroundColorOnInput;

  function backgroundColorOnInput() {
    const element = event.target;
    const value = element.value;
    if(value) {
      localStorage.ENTRY_BACKGROUND_COLOR = value;
    } else {
      delete localStorage.ENTRY_BACKGROUND_COLOR;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // Setup the entry margin slider element
  // todo: is it correct to set value to a string or an int?
  const entryMarginElement = document.getElementById('entry-margin');
  entryMarginElement.value = localStorage.ENTRY_MARGIN || '10';
  entryMarginElement.onchange = entryMarginElementOnChange;
  function entryMarginElementOnChange(event) {
    // TODO: why am i defaulting to 10 here?
    localStorage.ENTRY_MARGIN = event.target.value || '10';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const headerFontSizeElement = document.getElementById('header-font-size');
  headerFontSizeElement.value = localStorage.HEADER_FONT_SIZE || '1';
  headerFontSizeElement.onchange = headerFontSizeOnChange;
  function headerFontSizeOnChange(event) {
    localStorage.HEADER_FONT_SIZE = event.target.value || '1';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const inputBodyFontSize = document.getElementById('body-font-size');
  inputBodyFontSize.value = localStorage.BODY_FONT_SIZE || '1';
  inputBodyFontSize.onchange = bodyFontSizeOnChange;
  function bodyFontSizeOnChange(event) {
    localStorage.BODY_FONT_SIZE = event.target.value || '1';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const checkboxJustifyText = document.getElementById('justify-text');
  checkboxJustifyText.checked = 'JUSTIFY_TEXT' in localStorage;
  checkboxJustifyText.onchange = justifyTextCheckboxOnChange;
  function justifyTextCheckboxOnChange(event) {
    if(event.target.checked) {
      localStorage.JUSTIFY_TEXT = '1';
    } else {
      delete localStorage.JUSTIFY_TEXT;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const bodyLineHeightElement = document.getElementById('body-line-height');
  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  bodyLineHeightElement.value = (bodyLineHeight / 10).toFixed(2);
  bodyLineHeightElement.oninput = bodyLineHeightSliderOnChange;
  function bodyLineHeightSliderOnChange(event) {
    localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // Init the about section
  const manifest = chrome.runtime.getManifest();
  const extensionNameElement = document.getElementById('extension-name');
  extensionNameElement.textContent = manifest.name;
  const extensionVersionElement = document.getElementById('extension-version');
  extensionVersionElement.textValue = manifest.version;
  const extensionAuthorElement = document.getElementById('extension-author');
  extensionAuthorElement.textContent = manifest.author;
  const extensionDescriptionElement = document.getElementById(
    'extension-description');
  extensionDescriptionElement.textContent = manifest.description || '';
  const extensionHomepageElement = document.getElementById(
    'extension-homepage');
  extensionHomepageElement.textContent = manifest.homepage_url;

  // Initially show the subscriptions list
  const subscriptionListElement = document.getElementById('mi-subscriptions');
  OptionsPage.showSection(subscriptionListElement);
};

document.addEventListener('DOMContentLoaded', OptionsPage.onDOMContentLoaded);
