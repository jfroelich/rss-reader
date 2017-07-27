// See license.md

'use strict';

{ // Begin file block scope

const settingsChannel = new BroadcastChannel('settings');
settingsChannel.onmessage = function(event) {
  if(event.data === 'changed') {
    updateEntryCSSRules(event);
  }
};

// Navigation tracking
let currentMenuItem = null;
let currentSectionElement = null;

function showErrorMessage(messageString, shouldFadeIn) {
  hideErrorMessage();

  const errorElement = document.createElement('div');
  errorElement.setAttribute('id','options_error_message');

  const messageElement = document.createElement('span');
  messageElement.textContent = messageString;
  errorElement.appendChild(messageElement);

  const dismissErrorButton = document.createElement('button');
  dismissErrorButton.setAttribute('id', 'dismiss-error-button');
  dismissErrorButton.textContent = 'Dismiss';
  dismissErrorButton.onclick = hideErrorMessage;
  errorElement.appendChild(dismissErrorButton);

  if(shouldFadeIn) {
    errorElement.style.opacity = '0';
    document.body.appendChild(errorElement);
    fadeElement(container, 1,0);
  } else {
    errorElement.style.opacity = '1';
    showElement(errorElement);
    document.body.appendChild(errorElement);
  }
}

function hideErrorMessage() {
  const errorMessageElement = document.getElementById('options_error_message');
  if(errorMessageElement) {
    const dismissErrorButton = document.getElementById('dismiss-error-button');
    if(dismissErrorButton) {
      dismissErrorButton.removeEventListener('click', hideErrorMessage);
    }

    errorMessageElement.remove();
  }
}

// TODO: instead of removing and re-adding, reset and reuse
function showSubscriptionMonitor() {
  let monitorElement = document.getElementById('submon');
  if(monitorElement) {
    monitorElement.remove();
  }

  monitorElement = document.createElement('div');
  monitorElement.setAttribute('id', 'submon');
  monitorElement.style.opacity = '1';
  document.body.appendChild(monitorElement);

  const progressElement = document.createElement('progress');
  progressElement.textContent = 'Working...';
  monitor.appendChild(progressElement);
}

function appendSubscriptionMonitorMessage(messageString) {
  const messageElement = document.createElement('p');
  messageElement.textContent = messageString;

  const monitorElement = document.getElementById('submon');
  monitorElement.appendChild(messageElement);
}

function showSection(menuItemElement) {
  if(!menuItemElement) {
    throw new TypeError('Missing parameter menuItemElement');
  }

  // Do nothing if not switching sections
  if(currentMenuItem === menuItemElement) {
    return;
  }

  // Make the previous item appear de-selected
  if(currentMenuItem) {
    removeElementClass(currentMenuItem,
      'navigation-item-selected');
  }

  // Hide the old section
  if(currentSectionElement) {
    hideElement(currentSectionElement);
  }

  // Make the new item appear selected
  addElementClass(menuItemElement, 'navigation-item-selected');

  // Show the new section
  const sectionIdString = menuItemElement.getAttribute('section');
  const sectionElement = document.getElementById(sectionIdString);
  if(sectionElement) {
    showElement(sectionElement);
  }

  // Update the global tracking vars
  currentMenuItem = menuItemElement;
  currentSectionElement = sectionElement;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function updateFeedCount() {
  const feedListElement = document.getElementById('feedlist');
  const count = feedListElement.childElementCount;

  const feedCountElement = document.getElementById('subscription-count');
  if(count > 1000) {
    feedCountElement.textContent = ' (999+)';
  } else {
    feedCountElement.textContent = ` (${count})`;
  }
}

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.
// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object. Use a clearer name.
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
function appendFeed(feed, maintainOrder) {
  const itemElement = document.createElement('li');
  itemElement.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  itemElement.setAttribute('feed', feed.id);
  if(feed.description) {
    itemElement.setAttribute('title', feed.description);
  }
  itemElement.onclick = feedListItemOnClick;

  if(feed.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.src = feed.faviconURLString;
    if(feed.title)
      faviconElement.title = feed.title;
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  let feedTitleString = feed.title || 'Untitled';
  feedTitleString = truncateHTML(feedTitleString, 300);
  titleElement.textContent = feedTitleString;
  itemElement.appendChild(titleElement);
  const feedListElement = document.getElementById('feedlist');
  const normalizedTitleString = feedTitleString.toLowerCase();

  if(!maintainOrder) {
    feedListElement.appendChild(itemElement);
    return;
  }

  // Insert the feed element into the proper position in the list
  let didInsertElement = false;
  for(let childNode of feedListElement.childNodes) {
    const keyString = (childNode.getAttribute('sort-key') || '').toLowerCase();
    if(indexedDB.cmp(normalizedTitleString, keyString) < 1) {
      feedListElement.insertBefore(itemElement, childNode);
      didInsertElement = true;
      break;
    }
  }

  if(!didInsertElement) {
    feedListElement.appendChild(itemElement);
  }
}

// TODO: deprecate
function showSubscriptionPreview(urlObject) {
  startSubscription(urlObject);
}

function hideSubscriptionPreview() {
  const previewElement = document.getElementById('subscription-preview');
  hideElement(previewElement);
  const resultsListElement = document.getElementById(
    'subscription-preview-entries');

  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
}

// TODO: if subscribing from a discover search result, I already know some
// of the feed's other properties, such as its title and link. I should be
// passing those along to startSubscription and setting them here. Or
// startSubscription should expect a feed object as a parameter.
async function startSubscription(urlObject) {

  // TODO: remove this once preview is deprecated more fully
  hideSubscriptionPreview();

  showSubscriptionMonitor();
  appendSubscriptionMonitorMessage(`Subscribing to ${urlObject.href}`);

  const feed = {};
  addFeedURLString(feed, urlObject.href);
  const options = {};
  options.verbose = true;// temp
  // Leaving other options to defaults for now
  let subcribedfeed;
  let readerConn;
  let iconConn;
  try {
    const promises = [dbConnect(), favicon.connect()];
    const conns = await Promise.all(promises);
    readerConn = conns[0];
    iconConn = conns[1];
    subcribedfeed = await subscribe(readerConn, iconConn, feed, options);
  } catch(error) {
    console.warn(error);
  } finally {
    if(readerConn) {
      readerConn.close();
    }
    if(iconConn) {
      iconConn.close();
    }
  }

  if(!subcribedfeed) {
    // TODO: is it correct to return here? shouldn't this be visible error or
    // something?
    return;
  }

  // TODO: what is the second parameter? give it an express name here
  appendFeed(subcribedfeed, true);

  // TODO: rather than expressly updating the feed count here, this should
  // happen as a result of some update event that some listener reacts to
  // That event should probably be a BroadcastChannel message that is fired
  // by subscribe
  updateFeedCount();

  // Show a brief message that the subscription was successful
  const feedURLString = getFeedURLString(subcribedfeed);
  appendSubscriptionMonitorMessage(`Subscribed to ${feedURLString}`);

  // Hide the sub monitor
  // TODO: this should be a call to a helper function
  const monitorElement = document.getElementById('submon');
  // TODO: the other parameters should be named expressly
  await fadeElement(monitorElement, 2, 1);
  monitorElement.remove();

  // After subscribing switch back to the feed list
  const subsSectionElement = document.getElementById('subs-list-section');
  showSection(subsSectionElement);
}

// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
// TODO: should this even catch?
async function feedListItemOnClick(event) {

  const findFeedById = function(conn, feedId) {
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.get(feedId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const loadFeedFromDb = async function(feedId) {
    let conn;
    try {
      conn = await dbConnect();
      return await findFeedById(conn, feedIdNumber);
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn) {
        conn.close();
      }
    }
  };

  // Use current target to capture the element with the feed attribute
  const feedListItemElement = event.currentTarget;
  const feedIdString = feedListItemElement.getAttribute('feed');
  const feedIdNumber = parseInt(feedIdString, 10);
  const feed = await loadFeedFromDb(feedIdNumber);

  // TODO: should this throw?
  if(!feed) {
    console.error('No feed found with id', feedIdNumber);
    return;
  }

  const titleElement = document.getElementById('details-title');
  titleElement.textContent = feed.title || 'Untitled';

  const faviconElement = document.getElementById('details-favicon');
  if(feed.faviconURLString) {
    faviconElement.setAttribute('src', feed.faviconURLString);
  } else {
    faviconElement.removeAttribute('src');
  }

  const descriptionElement = document.getElementById(
    'details-feed-description');
  if(feed.description) {
    descriptionElement.textContent = feed.description;
  } else {
    descriptionElement.textContent = '';
  }

  const feedURLElement = document.getElementById('details-feed-url');
  feedURLElement.textContent = getFeedURLString(feed);
  const feedLinkElement = document.getElementById('details-feed-link');
  feedLinkElement.textContent = feed.link || '';
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.value = '' + feed.id;

  const detailsElement = document.getElementById('mi-feed-details');
  showSection(detailsElement);

  // Ensure the details are visible (when the list is long the details may not
  // be visible because of the scroll position)
  window.scrollTo(0,0);
}


// TODO: this function is too large
// TODO: favicon resolution is too slow. Display the results immediately
// using a placeholder. Then, in a separate non-blocking
// task, try and replace the default icon with the proper icon.
// TODO: Suppress resubmits if last query was a search and the
// query did not change?
async function subscribeFormOnSubmit(event) {
  // Prevent normal form submission behavior
  event.preventDefault();

  const queryElement = document.getElementById('subscribe-discover-query');
  let queryString = queryElement.value;
  queryString = queryString || '';
  queryString = queryString.trim();

  if(!queryString) {
    return false;
  }

  const noResultsElement = document.getElementById('discover-no-results');

  // Do nothing if searching in progress
  const progressElement = document.getElementById('discover-in-progress');
  if(isElementVisible(progressElement)) {
    return false;
  }

  // Do nothing if subscription in progress
  const monitorElement = document.getElementById('submon');
  if(monitorElement && isElementVisible(monitorElement)) {
    return false;
  }

  // Clear the previous results list
  const resultsListElement = document.getElementById('discover-results-list');
  resultsListElement.innerHTML  = '';

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  hideElement(progressElement);

  let urlObject = null;
  try {
    urlObject = new URL(queryString);
  } catch(exception) {
  }

  // If it is a URL, subscribe
  if(urlObject) {
    queryElement.value = '';
    // TODO: this should go straight to sub, not call sub preview
    showSubscriptionPreview(urlObject);
    return false;
  }

  // Search for feeds
  showElement(progressElement);

  let iconURL, linkURL, entryArray, query;
  const searchTimeout = 5000;
  try {
    ({query, entryArray} =
      await searchGoogleFeeds(queryString, searchTimeout));
  } catch(error) {
    console.debug(error);
    return false;
  } finally {
    hideElement(progressElement);
  }

  // Filter entries without urls
  entryArray = entryArray.filter((entryObject) => entryObject.url);

  // Convert to URL objects, filter entries with invalid urls
  entryArray = entryArray.filter((entryObject) => {
    try {
      entryObject.url = new URL(entryObject.url);
      return true;
    } catch(error) {
      return false;
    }
  });

  // Filter entries with identical normalized urls, favoring earlier entries
  // TODO: use a Set?
  const distinctURLStrings = [];
  entryArray = entryArray.filter((entryObject) => {
    if(distinctURLStrings.includes(entryObject.url.href))
      return false;
    distinctURLStrings.push(entryObject.url.href);
    return true;
  });

  // If, after filtering, there are no more entries, exit early
  if(!entryArray.length) {
    hideElement(resultsListElement);
    showElement(noResultsElement);
    return false;
  }

  // Sanitize entry title
  // TODO: use for..of
  const entryTitleMaxLength = 200;
  entryArray.forEach((entryObject) => {
    let title = entryObject.title;
    if(title) {
      title = filterControlCharacters(title);
      title = replaceHTML(title, '');
      title = truncateHTML(title, entryTitleMaxLength);
      entryObject.title = title;
    }
  });

  // Sanitize content snippet
  const replacement = '\u2026';
  const entrySnippetMaxLength = 400;
  // TODO: use for..of
  entryArray.forEach((entryObject) => {
    let snippet = entryObject.contentSnippet;
    if(snippet) {
      snippet = filterControlCharacters(snippet);
      snippet = snippet.replace(/<br\s*>/gi, ' ');
      snippet = truncateHTML(
        snippet, entrySnippetMaxLength, replacement);
      entryObject.contentSnippet = snippet;
    }
  });

  showElement(resultsListElement);
  hideElement(noResultsElement);

  const itemElement = document.createElement('li');
  itemElement.textContent = `Found ${entryArray.length} feeds.`;
  resultsListElement.appendChild(itemElement);

  const fs = new FaviconService();
  await fs.dbConnect();
  for(let result of entryArray) {
    if(!result.link) {
      continue;
    }
    linkURL = new URL(result.link);
    iconURL = await fs.lookup(linkURL);
    result.faviconURLString = iconURL;
  }
  fs.close();

  const elementArray = entryArray.map(createSearchResultElement);
  elementArray.forEach((el) => resultsListElement.appendChild(el));
  return false;// Signal no submit
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
function createSearchResultElement(feed) {
  const itemElement = document.createElement('li');
  const subscribeButton = document.createElement('button');
  subscribeButton.value = feed.url.href;
  subscribeButton.title = feed.url.href;
  subscribeButton.textContent = 'Subscribe';
  subscribeButton.onclick = subscribeButtonOnClick;
  itemElement.appendChild(subscribeButton);

  if(feed.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', feed.faviconURLString);
    if(feed.link) {
      faviconElement.setAttribute('title', feed.link);
    }
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.appendChild(faviconElement);
  }

  // TODO: don't allow for empty href value
  const titleElement = document.createElement('a');
  if(feed.link) {
    titleElement.setAttribute('href', feed.link);
  }
  titleElement.setAttribute('target', '_blank');
  titleElement.title = feed.title;
  titleElement.innerHTML = feed.title;
  itemElement.appendChild(titleElement);

  const snippetElement = document.createElement('span');
  snippetElement.innerHTML = feed.contentSnippet;
  itemElement.appendChild(snippetElement);

  const urlElement = document.createElement('span');
  urlElement.setAttribute('class', 'discover-search-result-url');
  urlElement.textContent = feed.url.href;
  itemElement.appendChild(urlElement);
  return itemElement;
}

function subscribeButtonOnClick(event) {
  const subscribeButton = event.target;
  const feedURLString = subscribeButton.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feedURLString) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const subMonitorElement = document.getElementById('submon');
  if(subMonitorElement && isElementVisible(subMonitorElement)) {
    return;
  }

  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feedURLObject = new URL(feedURLString);

  // TODO: this should make a call directly to the step that starts the
  // subscription process.
  showSubscriptionPreview(feedURLObject);
}

function removeFeedFromFeedList(feedIdNumber) {
  const feedElement = document.querySelector(
    `#feedlist li[feed="${feedIdNumber}"]`);

  if(!feedElement) {
    throw new Error('No feed element found with id ' + feedIdNumber);
  }

  feedElement.removeEventListener('click', feedListItemOnClick);
  feedElement.remove();

  // Upon removing the feed, update the displayed number of feeds.
  // TODO: this should actually be called from some listener instead by a
  // BroadcastChannel message, the event should be fired by the actual
  // thing that removes the feed from storage
  updateFeedCount();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feedListElement = document.getElementById('feedlist');
  const noFeedsElement = document.getElementById('nosubs');
  if(!feedListElement.childElementCount) {
    hideElement(feedListElement);
    showElement(noFeedsElement);
  }
}

// TODO: visually react to unsubscribe error
async function unsubscribeButtonOnClick(event) {
  const feedIdString = event.target.value;
  const feedIdNumber = parseInt(feedIdString, 10);

  let readerConn;
  try {
    readerConn = await dbConnect();
    const numEntriesDeleted = await unsubscribe(readerConn, feedIdNumber);
  } catch(error) {
    console.warn('Unsubscribe error:', error);
  } finally {
    if(readerConn) {
      readerConn.close();
    }
  }

  removeFeedFromFeedList(feedIdNumber);
  const subsListSection = document.getElementById('subs-list-section');
  showSection(subsListSection);
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: after import the feeds list needs to be refreshed
// TODO: notify the user if there was an error
function importOPMLButtonOnClick(event) {
  const uploaderInput = document.createElement('input');
  uploaderInput.setAttribute('type', 'file');
  uploaderInput.setAttribute('accept', 'application/xml');
  uploaderInput.addEventListener('change', importOPMLUploaderOnChange,
    {'once':true});
  uploaderInput.click();
}

async function importOPMLUploaderOnChange(event) {
  const uploaderInput = event.target;
  try {
    await importOPMLFiles(uploaderInput.files, true);
  } catch(error) {
    // TODO: visual feedback in event an error
    console.warn(error);
  }
}

// TODO: visual feedback
async function exportOPMLButtonOnClick(event) {

  const loadAllFeedsFromDb = function(conn) {
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const opmlTitle = 'Subscriptions';
  const fileName = 'subscriptions.xml';

  let conn;
  let feeds;
  try {
    conn = await dbConnect();
    feeds = await loadAllFeedsFromDb(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(!feeds) {
    return;
  }

  const blobObject = createOPMLBlob(feeds, opmlTitle);
  const objectURL = URL.createObjectURL(blobObject);
  const anchorElement = document.createElement('a');
  anchorElement.setAttribute('download', fileName);
  anchorElement.href = objectURL;
  anchorElement.click();
  URL.revokeObjectURL(objectURL);
}

function createOPMLBlob(feeds, title) {
  const doc = OPMLDocument.create(title);
  for(let feed of feeds) {
    const outline = {};
    outline.type = feed.type;
    outline.xmlUrl = getFeedURLString(feed);
    outline.title = feed.title;
    outline.description = feed.description;
    outline.htmlUrl = feed.link;
    doc.appendOutlineObject(outline);
  }
  return new Blob([doc.toString()], {'type': 'application/xml'});
}


// TODO: sort feeds alphabetically
// TODO: react to errors
async function initSubscriptionsSection() {

  const loadAllFeedsFromDb = function(conn) {
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const noFeedsElement = document.getElementById('nosubs');
  const feedListElement = document.getElementById('feedlist');
  let conn;
  let feeds;
  try {
    conn = await dbConnect();
    feeds = await loadAllFeedsFromDb(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(!feeds) {
    console.warn('feeds undefined');
    return;
  }

  // Sort the feeds by title using indexedDB.cmp
  feeds.sort(function(a, b) {
    const atitle = a.title ? a.title.toLowerCase() : '';
    const btitle = b.title ? b.title.toLowerCase() : '';
    return indexedDB.cmp(atitle, btitle);
  });

  for(let feed of feeds) {
    appendFeed(feed);

    // TODO: the update should happen as a result of call to append feed,
    // not here
    updateFeedCount();
  }

  if(!feeds.length) {
    showElement(noFeedsElement);
    hideElement(feedListElement);
  } else {
    hideElement(noFeedsElement);
    showElement(feedListElement);
  }
}

function navItemOnClick(event) {
  const clickedElement = event.target;
  const sectionElement = event.currentTarget;
  showSection(sectionElement);
}

function enableNotificationsCheckboxOnClick(event) {
  if(event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}

function enableBackgroundProcessingCheckboxOnClick(event) {
  if(event.target.checked) {
    chrome.permissions.request({'permissions': ['background']}, noop);
  } else {
    chrome.permissions.remove({'permissions': ['background']}, noop);
  }
}

function noop() {
  // No operation
}

// TODO: use a promise and an async function call instead of this separate
// helper, create a utility function for checking permission that returns a
// promise
function enableBackgroundProcessingOnCheckPermissions(isPermitted) {
  const checkbox = document.getElementById('enable-background');
  checkbox.checked = isPermitted;
}

function restrictIdlePollingCheckboxOnClick(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

// TODO: deprecate
function enableSubscriptionPreviewCheckboxOnChange(event) {
  if(event.target.checked) {
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  } else {
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  }
}

// TODO: deprecate
function subscriptionPreviewContinueButtonOnClick(event) {
  // TODO: why use currentTarget over target for no reason?
  const previewButton = event.currentTarget;
  const urlString = previewButton.value;
  hideSubscriptionPreview();

  if(!urlString) {
    console.debug('no url');
    return;
  }

  const feedURLObject = new URL(urlString);
  startSubscription(feedURLObject);
}

function backgroundImageMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BACKGROUND_IMAGE = event.target.value;
  } else {
    delete localStorage.BACKGROUND_IMAGE;
  }

  settingsChannel.postMessage('changed');
}

function headerFontMenuOnChange(event){
  const selectedOption = event.target.value;
  if(selectedOption) {
    localStorage.HEADER_FONT_FAMILY = selectedOption;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  settingsChannel.postMessage('changed');
}

function bodyFontMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BODY_FONT_FAMILY = event.target.value;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  settingsChannel.postMessage('changed');
}

function columnCountMenuOnChange(event) {
  if(event.target.value) {
    localStorage.COLUMN_COUNT = event.target.value;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  settingsChannel.postMessage('changed');
}

function entryBackgroundColorOnInput(event) {
  const element = event.target;
  const value = element.value;
  if(value) {
    localStorage.ENTRY_BACKGROUND_COLOR = value;
  } else {
    delete localStorage.ENTRY_BACKGROUND_COLOR;
  }

  settingsChannel.postMessage('changed');
}

function entryMarginOnChange(event) {
  // TODO: why am i defaulting to 10 here?
  localStorage.ENTRY_MARGIN = event.target.value || '10';

  settingsChannel.postMessage('changed');
}

function headerFontSizeOnChange(event) {
  localStorage.HEADER_FONT_SIZE = event.target.value || '1';
  settingsChannel.postMessage('changed');
}

function bodyFontSizeOnChange(event) {
  localStorage.BODY_FONT_SIZE = event.target.value || '1';
  settingsChannel.postMessage('changed');
}

function justifyCheckboxOnChange(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  settingsChannel.postMessage('changed');
}

function bodyHeightOnInput(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  settingsChannel.postMessage('changed');
}

// TODO: this could use some cleanup or at least some clarifying comments
function fadeElement(element, durationSeconds, delaySeconds) {
  return new Promise(function(resolve, reject) {
    const style = element.style;
    if(style.display === 'none') {
      style.display = '';
      style.opacity = '0';
    }

    if(!style.opacity) {
      style.opacity = style.display === 'none' ? '0' : '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${durationSeconds}s ease ${delaySeconds}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}

document.addEventListener('DOMContentLoaded', function(event) {

  const fonts = [
    'ArchivoNarrow-Regular',
    'Arial, sans-serif',
    'Calibri',
    'Calibri Light',
    'Cambria',
    'CartoGothicStd',
    'Clearly Different',
    'Essays1743',
    'FeltTip',
    'Georgia',
    'Montserrat',
    'MS Sans Serif',
    'News Cycle, sans-serif',
    'Noto Sans',
    'Open Sans Regular',
    'PathwayGothicOne',
    'PlayfairDisplaySC',
    'Raleway, sans-serif',
    'Roboto Regular'
  ];

  const imagePaths = [
    '/images/bgfons-paper_texture318.jpg',
    '/images/CCXXXXXXI_by_aqueous.jpg',
    '/images/paper-backgrounds-vintage-white.jpg',
    '/images/pickering-texturetastic-gray.png',
    '/images/reusage-recycled-paper-white-first.png',
    '/images/subtle-patterns-beige-paper.png',
    '/images/subtle-patterns-cream-paper.png',
    '/images/subtle-patterns-exclusive-paper.png',
    '/images/subtle-patterns-groove-paper.png',
    '/images/subtle-patterns-handmade-paper.png',
    '/images/subtle-patterns-paper-1.png',
    '/images/subtle-patterns-paper-2.png',
    '/images/subtle-patterns-paper.png',
    '/images/subtle-patterns-rice-paper-2.png',
    '/images/subtle-patterns-rice-paper-3.png',
    '/images/subtle-patterns-soft-wallpaper.png',
    '/images/subtle-patterns-white-wall.png',
    '/images/subtle-patterns-witewall-3.png',
    '/images/thomas-zucx-noise-lines.png'
  ];

  // Init CSS styles that affect the display preview area
  addEntryCSSRules();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const navFeedItemList = document.querySelectorAll('#navigation-menu li');
  for(let navFeedItem of navFeedItemList) {
    navFeedItem.onclick = navItemOnClick;
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const enableNotificationsCheckbox = document.getElementById(
    'enable-notifications');
  enableNotificationsCheckbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  // TODO: should i be using on click or on change?
  enableNotificationsCheckbox.onclick =
    enableNotificationsCheckboxOnClick;

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.
  // TODO: should this be onchange or onclick? I had previously named the
  // function onchange but was listening to onclick
  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API ?
  const enableBackgroundProcessingCheckbox = document.getElementById(
    'enable-background');
  // TODO: should i be using on click or on change?
  enableBackgroundProcessingCheckbox.onclick =
    enableBackgroundProcessingCheckboxOnClick;
  chrome.permissions.contains({'permissions': ['background']},
    enableBackgroundProcessingOnCheckPermissions);

  const enableRestrictIdlePollingCheckbox = document.getElementById(
    'enable-idle-check');
  enableRestrictIdlePollingCheckbox.checked =
    'ONLY_POLL_IF_IDLE' in localStorage;
  // TODO: should i be using on click or on change
  enableRestrictIdlePollingCheckbox.onclick =
    restrictIdlePollingCheckboxOnClick;


  // TODO: deprecate this because I plan to deprecate the preview ability.
  const jrOptionsEnableSubscriptionPreviewCheckbox =
    document.getElementById('enable-subscription-preview');
  jrOptionsEnableSubscriptionPreviewCheckbox.checked =
    'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  // TODO: should i be using on click or on change?
  jrOptionsEnableSubscriptionPreviewCheckbox.onchange =
    enableSubscriptionPreviewCheckboxOnChange;

  const exportOPMLButton = document.getElementById('button-export-opml');
  exportOPMLButton.onclick = exportOPMLButtonOnClick;
  const importOPMLButton = document.getElementById('button-import-opml');
  importOPMLButton.onclick = importOPMLButtonOnClick;

  initSubscriptionsSection();

  // Init feed details section unsubscribe button click handler
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = unsubscribeButtonOnClick;

  // Init the subscription form section
  const subscriptionForm = document.getElementById('subscription-form');
  subscriptionForm.onsubmit = subscribeFormOnSubmit;
  const continuePreviewButton = document.getElementById(
    'subscription-preview-continue');
  continuePreviewButton.onclick = subscriptionPreviewContinueButtonOnClick;

  // Init display settings

  // Setup the entry background image menu
  const backgroundImageMenu = document.getElementById('entry-background-image');
  backgroundImageMenu.onchange = backgroundImageMenuOnChange;

  // TODO: stop trying to reuse the option variable, create separate variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  backgroundImageMenu.appendChild(option);

  // Load bgimages menu
  const currentBackgroundImagePath = localStorage.BACKGROUND_IMAGE;
  const backgroundImagePathOffset = '/images/'.length;
  for(let path of imagePaths) {
    let pathOption = document.createElement('option');
    pathOption.value = path;
    pathOption.textContent = path.substring(backgroundImagePathOffset);
    pathOption.selected = currentBackgroundImagePath === path;
    backgroundImageMenu.appendChild(pathOption);
  }

  // Setup header font menu
  const headerFontMenu = document.getElementById('select_header_font');
  headerFontMenu.onchange = headerFontMenuOnChange;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  headerFontMenu.appendChild(option);
  const currentHeaderFont = localStorage.HEADER_FONT_FAMILY;
  for(let ff of fonts) {
    let headerFontOption = document.createElement('option');
    headerFontOption.value = ff;
    headerFontOption.selected = ff === currentHeaderFont;
    headerFontOption.textContent = ff;
    headerFontMenu.appendChild(headerFontOption);
  }

  // Setup the body font menu
  const bodyFontMenu = document.getElementById('select_body_font');
  bodyFontMenu.onchange = bodyFontMenuOnChange;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  bodyFontMenu.appendChild(option);
  const currentBodyFont = localStorage.BODY_FONT_FAMILY;
  for(let bff of fonts) {
    let bodyFontOption = document.createElement('option');
    bodyFontOption.value = bff;
    bodyFontOption.selected = bff === currentBodyFont;
    bodyFontOption.textContent = bff;
    bodyFontMenu.appendChild(bodyFontOption);
  }

  const columnCountElement = document.getElementById('column-count');
  const columnCounts = ['1', '2', '3'];
  for(let columnCount of columnCounts) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    columnCountElement.appendChild(option);
  }

  columnCountElement.onchange = columnCountMenuOnChange;

  const backgroundColorInput = document.getElementById(
    'entry-background-color');
  backgroundColorInput.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  backgroundColorInput.oninput = entryBackgroundColorOnInput;

  const marginInput = document.getElementById('entry-margin');
  marginInput.value = localStorage.ENTRY_MARGIN || '10';
  marginInput.onchange = entryMarginOnChange;

  const headerFontSizeInput = document.getElementById('header-font-size');
  headerFontSizeInput.value = localStorage.HEADER_FONT_SIZE || '1';
  headerFontSizeInput.onchange = headerFontSizeOnChange;

  const bodyFontSizeInput = document.getElementById('body-font-size');
  bodyFontSizeInput.value = localStorage.BODY_FONT_SIZE || '1';
  bodyFontSizeInput.onchange = bodyFontSizeOnChange;

  const justifyTextCheckbox = document.getElementById('justify-text');
  justifyTextCheckbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justifyTextCheckbox.onchange = justifyCheckboxOnChange;

  const bodyLineHeightInput = document.getElementById('body-line-height');
  const lineHeightAsNumber = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  bodyLineHeightInput.value = (lineHeightAsNumber / 10).toFixed(2);
  bodyLineHeightInput.oninput = bodyHeightOnInput;

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

  const subsListSection = document.getElementById('subs-list-section');
  showSection(subsListSection);
}, {'once': true});

////////////////////////////////////////////////////////////////////////
// Misc helper functions

// TODO: just inline?
function isURLObject(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

// TODO: deprecate?
function hideElement(element) {
  element.style.display = 'none';
}

// TODO: deprecate?
function showElement(element) {
  element.style.display = 'block';
}

// TODO: deprecate?
function addElementClass(element, className) {
  element.classList.add(className);
}

// TODO: deprecate?
function removeElementClass(element, className) {
  element.classList.remove(className);
}

// TODO: deprecate?
function isElementVisible(element) {
  return element.style.display !== 'none';
}

} // End file block scope
