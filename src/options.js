// See license.md

'use strict';

/*
TODO: remove subscription preview
TODO: resolve searchGoogleFeeds favicons after displaying results, async
*/

{ // Begin file block scope

let currentMenuItem = null;
let currentSection = null;

function hideElement(element) {
  element.style.display = 'none';
}

function showElement(element) {
  element.style.display = 'block';
}

function addClass(element, class_name) {
  element.classList.add(class_name);
}

function removeClass(element, class_name) {
  element.classList.remove(class_name);
}

function isVisible(element) {
  return element.style.display === 'block';
}

function showErrorMsg(msg, shouldFadeIn) {
  hideErrorMsg();

  const errorElement = document.createElement('div');
  errorElement.setAttribute('id','options_error_message');

  const msgElement = document.createElement('span');
  msgElement.textContent = msg;
  errorElement.appendChild(msgElement);

  const dismissBtn = document.createElement('button');
  dismissBtn.setAttribute('id', 'options_dismiss_error_button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.onclick = hideErrorMsg;
  errorElement.appendChild(dismissBtn);

  if(shouldFadeIn) {
    errorElement.style.opacity = '0';
    document.body.appendChild(errorElement);
    ReaderUtils.fadeElement(container, 1, 0);
  } else {
    errorElement.style.opacity = '1';
    showElement(errorElement);
    document.body.appendChild(errorElement);
  }
}

// TODO: maybe make an OptionsPageErrorMessage class and have this be
// a member function.
function hideErrorMsg() {
  const errorMsg = document.getElementById('options_error_message');
  if(errorMsg) {
    const dismissBtn = document.getElementById('options_dismiss_error_button');
    if(dismissBtn) {
      dismissBtn.removeEventListener('click', hideErrorMsg);
    }
    errorMsg.remove();
  }
}

// TODO: instead of removing and re-adding, reset and reuse
// TODO: maybe make an OptionsSubscriptionMonitor class and have this just be
// a member function. Call it a widget.
function showSubMonitor() {
  resetSubMonitor();
  const monitor = document.createElement('div');
  monitor.setAttribute('id', 'options_subscription_monitor');
  monitor.style.opacity = '1';
  document.body.appendChild(monitor);
  const progress = document.createElement('progress');
  progress.textContent = 'Working...';
  monitor.appendChild(progress);
}

function resetSubMonitor() {
  const monitor = document.getElementById('options_subscription_monitor');
  if(monitor) {
    monitor.remove();
  }
}

function appendSubMonitorMsg(msg) {
  const monitor = document.getElementById('options_subscription_monitor');

  if(!monitor) {
    throw new Error('Could not find options_subscription_monitor');
  }

  const msgElement = document.createElement('p');
  msgElement.textContent = msg;
  monitor.appendChild(msgElement);
}

function hideSubMonitor(callback, shouldFadeOut) {
  const monitor = document.getElementById('options_subscription_monitor');
  if(!monitor) {
    if(callback) {
      callback();
      return;
    }
  }

  if(shouldFadeOut) {
    ReaderUtils.fadeElement(monitor, 2, 1, removeThenCallback);
  } else {
    removeThenCallback();
  }

  function removeThenCallback() {
    if(monitor) {
      monitor.remove();
    }

    if(callback) {
      callback();
    }
  }
}

function showSection(menuItem) {
  if(!menuItem) {
    throw new TypeError('missing menuItem');
  }

  // Do nothing if not switching.
  if(currentMenuItem === menuItem) {
    return;
  }

  // Make the previous item appear de-selected
  if(currentMenuItem) {
    removeClass(currentMenuItem, 'navigation-item-selected');
  }

  // Hide the old section
  if(currentSection) {
    hideElement(currentSection);
  }

  // Make the new item appear selected
  addClass(menuItem, 'navigation-item-selected');

  // Show the new section
  const sectionId = menuItem.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  if(sectionElement) {
    showElement(sectionElement);
  }

  // Update the global tracking vars
  currentMenuItem = menuItem;
  currentSection = sectionElement;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function updateFeedCount() {
  const feedListElement = document.getElementById('feedlist');
  const feedCountElement = document.getElementById('subscription-count');
  const count = feedListElement.childElementCount;
  if(count > 1000) {
    feedCountElement.textContent = ' (999+)';
  } else {
    feedCountElement.textContent = ' (' + count + ')';
  }
}

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.
// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
function appendFeed(feed, shouldInsertInOrder) {
  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);

  if(feed.description) {
    item.setAttribute('title', feed.description);
  }

  item.onclick = feedListItemOnClick;

  if(feed.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.src = feed.faviconURLString;
    if(feed.title) {
      faviconElement.title = feed.title;
    }

    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    item.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  let feed_title_string = feed.title || 'Untitled';
  feed_title_string = rdr.html.truncate(feed_title_string, 300);
  titleElement.textContent = feed_title_string;
  item.appendChild(titleElement);

  const feedListElement = document.getElementById('feedlist');
  const lcTitleString = feed_title_string.toLowerCase();

  // Insert the feed item element into the proper position in the list
  if(shouldInsertInOrder) {
    let added = false;
    for(let child of feedListElement.childNodes) {
      const key = (child.getAttribute('sort-key') || '').toLowerCase();
      if(indexedDB.cmp(lcTitleString, key) < 0) {
        feedListElement.insertBefore(item, child);
        added = true;
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

// TODO: deprecate the ability to preview
function showSubPreview(url) {
  if(!ReaderUtils.isURLObject(url)) {
    throw new Error('url should be a URL');
  }


  hideSubPreview();

  if(!('ENABLE_SUBSCRIBE_PREVIEW' in localStorage)) {
    startSubscription(url);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    startSubscription(url);
    return;
  }

  const previewElement = document.getElementById('subscription-preview');
  showElement(previewElement);
  const progressElement = document.getElementById(
    'subscription-preview-load-progress');
  showElement(progressElement);

  const excludeEntries = false;
  fetchFeed(url, excludeEntries, SilentConsole, onFetchFeed);

  function onFetchFeed(fetchEvent) {
    if(event.type !== 'success') {
      console.dir(event);
      hideSubPreview();
      showErrorMsg('Unable to fetch' + url.href);
      return;
    }

    const progressElement = document.getElementById(
      'subscription-preview-load-progress');
    hideElement(progressElement);

    const feed = fetchEvent.feed;
    const titleElement = document.getElementById('subscription-preview-title');
    titleElement.textContent = feed.title || 'Untitled';

    // Fetch feed generates an array of URL objects. Use the last one in the
    // list as the button's value.
    const continueButton = document.getElementById(
      'subscription-preview-continue');
    continueButton.value = Feed.getURL(feed);

    const resultsListElement = document.getElementById(
      'subscription-preview-entries');

    if(!fetchEvent.entries.length) {
      let item = document.createElement('li');
      item.textContent = 'No previewable entries';
      resultsListElement.appendChild(item);
    }

    // TODO: if tags are replaced by searchGoogleFeeds then I don't need
    // to do it here
    const limit = Math.min(5, fetchEvent.entries.length);
    for(let i = 0; i < limit; i++) {
      const entry = fetchEvent.entries[i];
      const item = document.createElement('li');
      item.innerHTML = rdr.html.replaceTags(entry.title || '', '');
      const content = document.createElement('span');
      content.innerHTML = entry.content || '';
      item.appendChild(content);
      resultsListElement.appendChild(item);
    }
  }
}

function hideSubPreview() {
  const previewElement = document.getElementById('subscription-preview');
  hideElement(previewElement);
  const resultsListElement = document.getElementById(
    'subscription-preview-entries');
  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
}

function startSubscription(url) {
  if(!ReaderUtils.isURLObject(url)) {
    throw new TypeError('invalid url param: ' + url);
  }

  hideSubPreview();
  showSubMonitor();
  appendSubMonitorMsg('Subscribing to' + url.href);

  // TODO: if subscribing from a discover search result, I already know some
  // of the feed's other properties, such as its title and link. I should be
  // passing those along to startSubscription and setting them here. Or
  // startSubscription should expect a feed object as a parameter.

  const feed = {};
  Feed.addURL(feed, url.href);

  const conn = null;
  const suppressNotifications = false;
  subTask.start(conn, feed, suppressNotifications, SilentConsole, onSubscribe);

  function onSubscribe(event) {
    if(event.type !== 'success') {
      hideSubMonitor(showSubErrorMsg.bind(null, event.type));
      return;
    }

    appendFeed(event.feed, true);
    updateFeedCount();
    const feedURL = Feed.getURL(event.feed);
    appendSubMonitorMsg('Subscribed to ' + feedURL);

    // Hide the sub monitor then switch back to the main feed list
    hideSubMonitor(function() {
      const subElement = document.getElementById('mi-subscriptions');
      showSection(subElement);
    }, true);
  }

  function showSubErrorMsg(type) {

    console.debug('error: showing error with type', type);

    if(type === 'ConstraintError') {
      showErrorMsg('Already subscribed to ' + url.href);
    } else if(type === 'FetchError') {
      showErrorMsg('Failed to fetch ' + url.href);
    } else if(type === 'ConnectionError') {
      showErrorMsg('Unable to connect to database');
    } else if(type === 'FetchMimeTypeError') {
      showErrorMsg('The page at ' + url.href + ' is not an xml feed ' +
        '(it has the wrong content type)');
    } else {
      showErrorMsg('Unknown error');
    }
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
function populateFeedInfo(feedId) {

  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError('invalid feed id param: ' + feedId);
  }

  const context = {'db': null};
  const openDBTask = new FeedDb();
  openDBTask.open(openDBOnSuccess, openDBOnError);
  function openDBOnSuccess(event) {
    context.db = event.target.result;
    const transaction = context.db.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = onFindFeed;
    request.onerror = onFindFeed;
  }

  function openDBOnError(event) {
    // TODO: show an error message?
    console.error(event.target.error);
  }

  function onFindFeed(event) {
    if(event.type !== 'success') {
      console.error(event);
      if(context.db) {
        context.db.close();
      }

      return;
    }

    if(!event.target.result) {
      console.error('No feed found with id', feedId);
      if(context.db) {
        context.db.close();
      }
      return;
    }

    const feed = event.target.result;

    const titleElement = document.getElementById('details-title');
    titleElement.textContent = feed.title || 'Untitled';

    const faviconElement = document.getElementById('details-favicon');
    if(feed.faviconURLString) {
      faviconElement.setAttribute('src', feed.faviconURLString);
    } else {
      faviconElement.removeAttribute('src');
    }

    const descElement = document.getElementById('details-feed-description');
    if(feed.description) {
      descElement.textContent = feed.description;
    } else {
      descElement.textContent = '';
    }

    const feedURLElement = document.getElementById('details-feed-url');
    feedURLElement.textContent = Feed.getURL(feed);

    const feedLinkElement = document.getElementById('details-feed-link');
    if(feed.link) {
      feedLinkElement.textContent = feed.link;
    } else {
      feedLinkElement.textContent = '';
    }

    const unsubButton = document.getElementById('details-unsubscribe');
    unsubButton.value = '' + feed.id;

    if(context.db) {
      context.db.close();
    }
  }
}

function feedListItemOnClick(event) {
  const element = event.currentTarget;
  const feedIdString = element.getAttribute('feed');
  const feedId = parseInt(feedIdString, 10);

  // TODO: change to an assert
  if(isNaN(feedId)) {
    console.debug('Invalid feed id:', feedIdString);
    // TODO: react to this error
    return;
  }

  populateFeedInfo(feedId);
  // TODO: These calls should really be in an async callback
  // passed to populateFeedInfo
  const detailsElement = document.getElementById('mi-feed-details');
  showSection(detailsElement);

  // Ensure the details are visible. If scrolled down when viewing large
  // list of feeds, it would otherwise not be immediately visible.
  window.scrollTo(0,0);
}

// TODO: Suppress resubmits if last query was a search and the
// query did not change?
function subFormOnSubmit(event) {
  // Prevent normal form submission behavior
  event.preventDefault();

  const queryElement = document.getElementById('subscribe-discover-query');
  let queryString = queryElement.value;
  queryString = queryString || '';
  queryString = queryString.trim();

  if(!queryString) {
    return false;
  }

  // Do nothing if searching in progress
  const progressElement = document.getElementById('discover-in-progress');
  if(isVisible(progressElement)) {
    return false;
  }

  // Do nothing if subscription in progress
  const monitor = document.getElementById('options_subscription_monitor');
  if(monitor && isVisible(monitor)) {
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
  hideElement(progressElement);

  let url = null;
  try {
    url = new URL(queryString);
  } catch(exception) {}

  // If it is a URL, subscribe, otherwise, search
  if(url) {
    queryElement.value = '';
    showSubPreview(url);
  } else {
    showElement(progressElement);
    searchGoogleFeeds(queryString, SilentConsole, onSearchGoogleFeeds);
  }

  return false;
}

function subscribeButtonOnClick(event) {
  const button = event.target;
  const feedURLString = button.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feedURLString) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const monitor = document.getElementById('options_subscription_monitor');
  if(monitor && isVisible(monitor)) {
    return;
  }

  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feedURL = new URL(feedURLString);
  // TODO: I plan to deprecate the preview step, so this should probably be
  // making a call directly to the step that starts the subscription process.
  showSubPreview(feedURL);
}

// TODO: favicon resolution is too slow. Display the results immediately using
// a default favicon. Then, in a separate non-blocking interruptable task,
// try and replace the default icon with the proper icon.
function onSearchGoogleFeeds(event) {
  const query = event.query;
  const results = event.entries;
  const progressElement = document.getElementById('discover-in-progress');
  const noResultsElement = document.getElementById('discover-no-results');
  const resultsElement = document.getElementById('discover-results-list');

  // If an error occurred, hide the progress element and show an error message
  // and exit early.
  if(event.type !== 'success') {
    console.debug(event);
    hideElement(progressElement);
    showErrorMsg('An error occurred when searching for feeds');
    return;
  }

  // Searching completed, hide the progress
  hideElement(progressElement);
  if(!results.length) {
    hideElement(resultsElement);
    showElement(noResultsElement);
    return;
  }

  if(isVisible(resultsElement)) {
    resultsElement.innerHTML = '';
  } else {
    hideElement(noResultsElement);
    showElement(resultsElement);
  }

  // Add an initial count of the number of feeds as one of the feed list items
  const itemElement = document.createElement('li');
  // TODO: use string template
  itemElement.textContent = 'Found ' + results.length + ' results.';
  resultsElement.appendChild(itemElement);

  // Lookup the favicons for the results.
  // TODO: this should be the responsibility of searchGoogleFeeds and not
  // options. This is way too much logic in the UI I think

  let numFaviconsProcessed = 0;
  for(let result of results) {
    if(result.link) {
      let linkURL = null;
      try {
        linkURL = new URL(result.link);
      } catch(exception) {
      }
      if(linkURL) {
        const cache = new FaviconCache();
        const doc = null;
        lookupFavicon(cache, linkURL, doc, SilentConsole,
          onLookupFavicon.bind(null, result));
      } else {
        numFaviconsProcessed++;
        if(numFaviconsProcessed === results.length) {
          onFaviconsProcessed();
        }
      }
    } else {
      numFaviconsProcessed++;
      if(numFaviconsProcessed === results.length) {
        onFaviconsProcessed();
      }
    }
  }

  if(!results.length) {
    console.debug('No results so favicon processing finished');
    onFaviconsProcessed();
  }

  function onLookupFavicon(result, iconURL) {
    numFaviconsProcessed++;
    if(iconURL) {
      result.faviconURLString = iconURL.href;
    }

    if(numFaviconsProcessed === results.length) {
      onFaviconsProcessed();
    }
  }

  function onFaviconsProcessed() {
    console.debug('Finished processing favicons for search results');
    // Generate an array of result elements to append
    const resultElements = results.map(createSearchResultElement);

    // Append the result elements
    for(let i = 0, len = resultElements.length; i < len; i++) {
      resultsElement.appendChild(resultElements[i]);
    }
  }
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
function createSearchResultElement(feed) {
  const item = document.createElement('li');
  const subscribeButton = document.createElement('button');
  subscribeButton.value = feed.url.href;
  subscribeButton.title = feed.url.href;
  subscribeButton.textContent = 'Subscribe';
  subscribeButton.onclick = subscribeButtonOnClick;
  item.appendChild(subscribeButton);

  if(feed.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', feed.faviconURLString);
    if(feed.link) {
      faviconElement.setAttribute('title', feed.link);
    }
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    item.appendChild(faviconElement);
  }

  // TODO: don't allow for empty href value
  const titleAnchor = document.createElement('a');
  if(feed.link) {
    titleAnchor.setAttribute('href', feed.link);
  }
  titleAnchor.setAttribute('target', '_blank');
  titleAnchor.title = feed.title;
  titleAnchor.innerHTML = feed.title;
  item.appendChild(titleAnchor);

  const snippetSpan = document.createElement('span');
  snippetSpan.innerHTML = feed.contentSnippet;
  item.appendChild(snippetSpan);

  const urlSpan = document.createElement('span');
  urlSpan.setAttribute('class', 'discover-search-result-url');
  urlSpan.textContent = feed.url.href;
  item.appendChild(urlSpan);
  return item;
}

function removeFeedFromFeedList(feedId) {
  // TODO: use string template
  const selector = '#feedlist li[feed="' + feedId + '"]';
  const feedElement = document.querySelector(selector);

  if(!feedElement) {
    throw new Error('did not find feed element for feed id ' + feedId);
  }

  feedElement.removeEventListener('click', feedListItemOnClick);
  feedElement.remove();

  // Upon removing the feed, update the displayed number of feeds.
  updateFeedCount();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feedList = document.getElementById('feedlist');
  const noFeeds = document.getElementById('nosubscriptions');
  if(!feedList.childElementCount) {
    hideElement(feedList);
    showElement(noFeeds);
  }
}

function unsubButtonOnClick(event) {
  console.debug('Clicked unsubscribe');
  const feedId = parseInt(event.target.value, 10);

  if(!Number.isInteger(feedId)) {
    throw new TypeError('invalid feed id', event.target.value);
  }

  unsubscribe(feedId, SilentConsole, onUnsubscribeCompleted.bind(null, feedId));
}

// TODO: provide visual feedback on success or error
function onUnsubscribeCompleted(feedId, event) {
  console.debug('Unsubscribe completed using feed id', feedId);
  if(event.type !== 'success') {
    console.debug(event);
    return;
  }

  removeFeedFromFeedList(feedId);
  const subsSection = document.getElementById('mi-subscriptions');
  showSection(subsSection);
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error
// - in order to do this, importOPML needs to callback with any
// errors that occurred, and also callback when no errors occurred so this can
// tell the difference
// TODO: switch to a different section of the options ui on complete?
function importOPMLButtonOnClick(event) {
  const db = new FeedDb();
  importOPML(db, SilentConsole);
}

// TODO: visual feedback
function exportOPMLButtonOnClick(event) {
  const db = new FeedDb();
  const title = 'Subscriptions';
  const fileName = 'subs.xml';
  const callback = null;
  exportOPML(db, title, fileName, SilentConsole, callback);
}

// TODO: use getAllFeeds and then sort manually, to avoid the defined title
// requirement (and deprecate title index)
function initSubsSection() {
  let feedCount = 0;
  const openDBTask = new FeedDb();
  openDBTask.open(openDBOnSuccess, openDBOnError);

  function openDBOnSuccess(event) {
    const db = event.target.result;
    const tx = db.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('title');
    const request = index.openCursor();
    request.onsuccess = openCursorOnSuccess;
  }

  function openDBOnError(event) {
    // TODO: react to error
    console.error(event.target.error);
  }

  function openCursorOnSuccess(event) {
    const cursor = event.target.result;
    if(cursor) {
      const feed = cursor.value;
      feedCount++;
      appendFeed(feed);
      updateFeedCount();
      cursor.continue();
    } else {
      onFeedsIterated();
    }
  }

  function onFeedsIterated() {
    const noFeedsElement = document.getElementById('nosubscriptions');
    const feedListElement = document.getElementById('feedlist');
    if(feedCount === 0) {
      showElement(noFeedsElement);
      hideElement(feedListElement);
    } else {
      hideElement(noFeedsElement);
      showElement(feedListElement);
    }
  }
}

// Upon clicking a feed in the feed list, switch to showing the details
// of that feed
// Use currentTarget instead of event.target as some of the menu items have a
// nested element that is the desired target
// TODO: rather than comment, use a local variable here to clarify why
// currentTarget is more appropriate
function onNavItemClick(event) {
  showSection(event.currentTarget);
}

function enableNotificationsCheckboxOnChange(event) {
  if(event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}

function enableBackgroundProcessingCheckboxOnClick(event) {
  if(event.target.checked) {
    chrome.permissions.request({'permissions': ['background']}, noop);
  }
  else {
    chrome.permissions.remove({'permissions': ['background']}, noop);
  }

  function noop() {}
}

function onCheckBackgroundProcessingPermission(permitted) {
  const checkbox = document.getElementById('enable-background');
  checkbox.checked = permitted;
}

function restrictIdlePollingCheckboxOnChange(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

function enablePreviewCheckboxOnChange(event) {
  if(this.checked) {
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  } else {
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  }
}

function previewContinueButtonOnClick(event) {
  const url_string = event.currentTarget.value;
  hideSubPreview();

  if(!url_string) {
    console.debug('no url');
    return;
  }

  const feedURL = new URL(url_string);
  startSubscription(feedURL);
}

function entryBgImgMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BACKGROUND_IMAGE = event.target.value;
  } else {
    delete localStorage.BACKGROUND_IMAGE;
  }

  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function headerFontMenuOnChange(event){
  const selectedOption = event.target.value;
  if(selectedOption) {
    localStorage.HEADER_FONT_FAMILY = selectedOption;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function bodyFontMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BODY_FONT_FAMILY = event.target.value;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function colCountMenuOnChange(event) {
  if(event.target.value) {
    localStorage.COLUMN_COUNT = event.target.value;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function entryBgColorElementOnInput() {
  const element = event.target;
  const value = element.value;
  if(value) {
    localStorage.ENTRY_BACKGROUND_COLOR = value;
  } else {
    delete localStorage.ENTRY_BACKGROUND_COLOR;
  }
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function entryMarginOnChange(event) {
  // TODO: why am i defaulting to 10 here?
  localStorage.ENTRY_MARGIN = event.target.value || '10';
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function headerFontSizeElementOnChange(event) {
  localStorage.HEADER_FONT_SIZE = event.target.value || '1';
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function bodyFontSizeElementOnChange(event) {
  localStorage.BODY_FONT_SIZE = event.target.value || '1';
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function justifyTextCheckboxOnChange(event) {
  if(event.target.checked) {
    localStorage.JUSTIFY_TEXT = '1';
  } else {
    delete localStorage.JUSTIFY_TEXT;
  }
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function bodyLineHeightElementOnInput(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
}

function onDOMContentLoaded(event) {
  // Avoid attempts to re-init
  document.removeEventListener('DOMContentLoaded', onDOMContentLoaded);

  // Init CSS styles that affect the display preview area
  DisplaySettings.loadStyles();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  // TODO: use for .. of
  const navFeedItems = document.querySelectorAll('#navigation-menu li');
  for(let i = 0, len = navFeedItems.length; i < len; i++) {
    navFeedItems[i].onclick = onNavItemClick;
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const enableNotificationsCheckbox = document.getElementById(
    'enable-notifications');
  enableNotificationsCheckbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  enableNotificationsCheckbox.onclick = enableNotificationsCheckboxOnChange;

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.
  // TODO: should this be onchange or onclick? I had previously named the
  // function onchange but was listening to onclick
  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API ?
  const enableBackgroundProcessingCheckbox = document.getElementById(
    'enable-background');
  enableBackgroundProcessingCheckbox.onclick =
    enableBackgroundProcessingCheckboxOnClick;
  chrome.permissions.contains({'permissions': ['background']},
    onCheckBackgroundProcessingPermission);

  const restrictIdlePollingCheckbox = document.getElementById(
    'enable-idle-check');
  restrictIdlePollingCheckbox.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
  restrictIdlePollingCheckbox.onclick = restrictIdlePollingCheckboxOnChange;

  // TODO: deprecate this because I plan to deprecate the preview ability.
  const enablePreviewCheckbox =
    document.getElementById('enable-subscription-preview');
  enablePreviewCheckbox.checked = 'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  enablePreviewCheckbox.onchange = enablePreviewCheckboxOnChange;

  // Init the opml import/export buttons
  const exportOPMLButton = document.getElementById('button-export-opml');
  exportOPMLButton.onclick = exportOPMLButtonOnClick;
  const importOPMLButton = document.getElementById('button-import-opml');
  importOPMLButton.onclick = importOPMLButtonOnClick;

  initSubsSection();

  // Init feed details section unsubscribe button click handler
  const unsubButton = document.getElementById('details-unsubscribe');
  unsubButton.onclick = unsubButtonOnClick;

  // Init the subscription form section
  const subForm = document.getElementById('subscription-form');
  subForm.onsubmit = subFormOnSubmit;
  const previewContinueButton = document.getElementById(
    'subscription-preview-continue');
  previewContinueButton.onclick = previewContinueButtonOnClick;

  // Init display settings

  // Setup the entry background image menu
  const entryBgImgMenu = document.getElementById('entry-background-image');
  entryBgImgMenu.onchange = entryBgImgMenuOnChange;

  // TODO: stop trying to reuse the option variable, create separate variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  entryBgImgMenu.appendChild(option);

  // Load and append the various background images into the menu. Set the
  // selected option.
  // TODO: this shouldn't read from the local storage variable per call
  // TODO: use a basic for loop, or for..of
  DisplaySettings.BACKGROUND_IMAGE_PATHS.forEach(appendBgImg);
  function appendBgImg(path) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/images/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE === path;
    entryBgImgMenu.appendChild(option);
  }

  // Setup the header font menu
  const headerFontMenu = document.getElementById('select_header_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  // TODO: use a basic for loop, or for..of
  DisplaySettings.FONT_FAMILIES.forEach(appendHeaderFont);
  function appendHeaderFont(fontFamily) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  }

  headerFontMenu.onchange = headerFontMenuOnChange;

  // Setup the body font menu
  const bodyFontMenu = document.getElementById('select_body_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  bodyFontMenu.appendChild(option);

  // TODO: use a basic for loop, or for..of
  DisplaySettings.FONT_FAMILIES.forEach(appendBodyFont);
  function appendBodyFont(fontFamily) {
    // TODO: use a local variable for option
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    bodyFontMenu.appendChild(option);
  }
  bodyFontMenu.onchange = bodyFontMenuOnChange;

  const colCountElement = document.getElementById('column-count');

  // TODO: use a basic for loop here (or for .. of)
  ['1','2','3'].forEach(appendColCount);
  function appendColCount(columnCount) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    colCountElement.appendChild(option);
  }

  colCountElement.onchange = colCountMenuOnChange;

  const entryBgColorElement = document.getElementById(
    'entry-background-color');
  entryBgColorElement.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  entryBgColorElement.oninput = entryBgColorElementOnInput;

  // Setup the entry margin slider element
  const marginElement = document.getElementById('entry-margin');
  marginElement.value = localStorage.ENTRY_MARGIN || '10';
  marginElement.onchange = entryMarginOnChange;

  const headerFontSizeElement = document.getElementById('header-font-size');
  headerFontSizeElement.value = localStorage.HEADER_FONT_SIZE || '1';
  headerFontSizeElement.onchange = headerFontSizeElementOnChange;

  const bodyFontSizeElement = document.getElementById('body-font-size');
  bodyFontSizeElement.value = localStorage.BODY_FONT_SIZE || '1';
  bodyFontSizeElement.onchange = bodyFontSizeElementOnChange;

  const justifyTextCheckbox = document.getElementById('justify-text');
  justifyTextCheckbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justifyTextCheckbox.onchange = justifyTextCheckboxOnChange;

  const bodyLineHeightElement = document.getElementById('body-line-height');
  const lineHeightInt = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  bodyLineHeightElement.value = (lineHeightInt / 10).toFixed(2);
  bodyLineHeightElement.oninput = bodyLineHeightElementOnInput;

  // Init the about section
  const manifest = chrome.runtime.getManifest();
  const extNameElement = document.getElementById('extension-name');
  extNameElement.textContent = manifest.name;
  const extVersionElement = document.getElementById('extension-version');
  extVersionElement.textValue = manifest.version;
  const extAuthorElement = document.getElementById('extension-author');
  extAuthorElement.textContent = manifest.author;
  const extDescElement = document.getElementById('extension-description');
  extDescElement.textContent = manifest.description || '';
  const extHomepageElement = document.getElementById('extension-homepage');
  extHomepageElement.textContent = manifest.homepage_url;

  // Initially show the subscriptions list
  const subsSection = document.getElementById('mi-subscriptions');
  showSection(subsSection);
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

} // End file block scope
