// See license.md

'use strict';

// TODO: create issues for these todos and delete them here
// TODO: remove subscription preview
// TODO: lookup favicons after displaying search results, not before
// TODO: listen for poll events, feed information may have updated
// TODO: add back button behavior for switching sections (popstate stuff)
// TODO: remove unreadable fonts


const optpg = {};

optpg.fontsArray = [
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

optpg.bgImagePathsArray = [
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

optpg.settingsChannel = new BroadcastChannel('settings');
optpg.currentMenuItem = null;
optpg.currentSectionElement = null;

optpg.showErrorMessage = function(messageString, shouldFadeIn) {
  optpg.hideErrorMessage();

  const errorElement = document.createElement('div');
  errorElement.setAttribute('id','options_error_message');

  const messageElement = document.createElement('span');
  messageElement.textContent = messageString;
  errorElement.appendChild(messageElement);

  const dismissErrorButton = document.createElement('button');
  dismissErrorButton.setAttribute('id', 'dismiss-error-button');
  dismissErrorButton.textContent = 'Dismiss';
  dismissErrorButton.onclick = optpg.hideErrorMessage;
  errorElement.appendChild(dismissErrorButton);

  if(shouldFadeIn) {
    errorElement.style.opacity = '0';
    document.body.appendChild(errorElement);
    utils.fadeElement(container, 1,0);
  } else {
    errorElement.style.opacity = '1';
    utils.showElement(errorElement);
    document.body.appendChild(errorElement);
  }
};

optpg.hideErrorMessage = function() {
  const errorMessageElement = document.getElementById('options_error_message');
  if(errorMessageElement) {
    const dismissErrorButton = document.getElementById(
      'dismiss-error-button');
    if(dismissErrorButton) {
      dismissErrorButton.removeEventListener('click',
      optpg.hideErrorMessage);
    }

    errorMessageElement.remove();
  }
};

// TODO: instead of removing and re-adding, reset and reuse
optpg.showSubscriptionMonitor = function() {
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
};

optpg.appendSubscriptionMonitorMessage = function(messageString) {
  const monitorElement = document.getElementById('submon');
  if(!monitorElement) {
    throw new Error('Element with id "submon" not found');
  }

  const messageElement = document.createElement('p');
  messageElement.textContent = messageString;
  monitorElement.appendChild(messageElement);
};

optpg.showSection = function(menuItemElement) {
  if(!menuItemElement) {
    throw new TypeError('Missing parameter menuItemElement');
  }

  // Do nothing if not switching sections
  if(optpg.currentMenuItem === menuItemElement) {
    return;
  }

  // Make the previous item appear de-selected
  if(optpg.currentMenuItem) {
    utils.removeElementClass(optpg.currentMenuItem,
      'navigation-item-selected');
  }

  // Hide the old section
  if(optpg.currentSectionElement) {
    utils.hideElement(optpg.currentSectionElement);
  }

  // Make the new item appear selected
  utils.addElementClass(menuItemElement, 'navigation-item-selected');

  // Show the new section
  const sectionIdString = menuItemElement.getAttribute('section');
  const sectionElement = document.getElementById(sectionIdString);
  if(sectionElement) {
    utils.showElement(sectionElement);
  }

  // Update the global tracking vars
  optpg.currentMenuItem = menuItemElement;
  optpg.currentSectionElement = sectionElement;
};

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
optpg.updateFeedCount = function() {
  const feedListElement = document.getElementById('feedlist');
  const feedCountElement = document.getElementById('subscription-count');
  const count = feedListElement.childElementCount;

  if(count > 1000) {
    feedCountElement.textContent = ' (999+)';
  } else {
    feedCountElement.textContent = ` (${count})`;
  }
};

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.
// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
optpg.appendFeed = function(feedObject, maintainOrder) {
  const itemElement = document.createElement('li');
  itemElement.setAttribute('sort-key', feedObject.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  itemElement.setAttribute('feed', feedObject.id);
  if(feedObject.description) {
    itemElement.setAttribute('title', feedObject.description);
  }
  itemElement.onclick = optpg.feedListsItemOnClick;

  if(feedObject.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.src = feedObject.faviconURLString;
    if(feedObject.title)
      faviconElement.title = feedObject.title;
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  let feedTitleString = feedObject.title || 'Untitled';
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
};

// TODO: deprecate
optpg.showSubscriptionPreview = function(urlObject) {
  optpg.startSubscription(urlObject);
};

optpg.hideSubscriptionPreview = function() {
  const previewElement = document.getElementById('subscription-preview');
  utils.hideElement(previewElement);
  const resultsListElement = document.getElementById(
    'subscription-preview-entries');

  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
};

// TODO: if subscribing from a discover search result, I already know some
// of the feed's other properties, such as its title and link. I should be
// passing those along to optpg.startSubscription and setting them here. Or
// optpg.startSubscription should expect a feed object as a parameter.
optpg.startSubscription = async function(urlObject) {

  // TODO: not really sure if this validation is correct to do, my thinking is
  // that it is overly defensive
  if(!utils.isURLObject(urlObject)) {
    throw new TypeError('Invalid urlObject parameter');
  }

  // TODO: remove this once preview is deprecated more fully
  optpg.hideSubscriptionPreview();

  optpg.showSubscriptionMonitor();
  optpg.appendSubscriptionMonitorMessage(`Subscribing to ${urlObject.href}`);

  const feedObject = {};
  feed.addURLString(feedObject, urlObject.href);

  // TODO: subscription service object is deprecated

  const subService = new SubscriptionService();
  subService.verbose = true;
  let subcribedFeedObject;
  try {
    await subService.db.connect();

    // TODO: this needs entirely different params
    // dbConn, iconDbConn, feedObject, options, logObject
    subcribedFeedObject = await operations.subscribe(feedObject);
  } catch(error) {
    console.debug(error);
  } finally {
    subService.close();
  }

  if(!subcribedFeedObject) {
    // TODO: is it correct to return here? shouldn't this be visible error or
    // something?
    return;
  }

  // TODO: what is the second parameter? give it an express name here
  optpg.appendFeed(subcribedFeedObject, true);

  // TODO: rather than expressly updating the feed count here, this should
  // happen as a result of some update event that some listener reacts to
  // That event should probably be a BroadcastChannel message that is fired
  // by operations.subscribe
  optpg.updateFeedCount();

  // Show a brief message that the subscription was successful
  const feedURLString = feed.getURLString(subcribedFeedObject);
  optpg.appendSubscriptionMonitorMessage(`Subscribed to ${feedURLString}`);

  // Hide the sub monitor
  // TODO: this should be a call to a helper function
  const monitorElement = document.getElementById('submon');
  // TODO: the other parameters should be named expressly
  await utils.fadeElement(monitorElement, 2, 1);
  monitorElement.remove();

  // After subscribing switch back to the feed list
  const subsSectionElement = document.getElementById('subs-list-section');
  optpg.showSection(subsSectionElement);
};



// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
// TODO: should this even catch?
// TODO: this function is big, maybe add helpers
optpg.feedListsItemOnClick = async function(event) {

  // Use current target to capture the element with the feed attribute and
  // not a different element
  const feedListItemElement = event.currentTarget;

  const feedIdString = feedListItemElement.getAttribute('feed');
  const feedIdNumber = parseInt(feedIdString, 10);

  // TODO: these are deprecated
  const readerDb = new ReaderDb();
  const feedStore = new FeedStore();

  let feedObject;
  let conn;
  try {
    conn = await readerDb.db.connect();
    feedStore.conn = conn;
    feedObject = await feedStore.findById(feedIdNumber);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }

  // TODO: should this throw?
  if(!feedObject) {
    console.error('No feed found with id', feedIdNumber);
    return;
  }

  const titleElement = document.getElementById('details-title');
  titleElement.textContent = feedObject.title || 'Untitled';

  const faviconElement = document.getElementById('details-favicon');
  if(feedObject.faviconURLString) {
    faviconElement.setAttribute('src', feedObject.faviconURLString);
  } else {
    faviconElement.removeAttribute('src');
  }

  const descriptionElement = document.getElementById(
    'details-feed-description');
  if(feedObject.description) {
    descriptionElement.textContent = feedObject.description;
  } else {
    descriptionElement.textContent = '';
  }

  const feedURLElement = document.getElementById('details-feed-url');
  feedURLElement.textContent = feed.getURLString(feedObject);
  const feedLinkElement = document.getElementById('details-feed-link');
  feedLinkElement.textContent = feedObject.link || '';
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.value = '' + feedObject.id;

  const detailsElement = document.getElementById('mi-feed-details');
  optpg.showSection(detailsElement);

  // Scroll to the top to ensure that if a long feed list was shown and
  // the window was scrolled down that the details are immediately visible
  window.scrollTo(0,0);
};


// TODO: this function is too large
// TODO: favicon resolution is too slow. Display the results immediately
// using a placeholder. Then, in a separate non-blocking
// task, try and replace the default icon with the proper icon.
// TODO: Suppress resubmits if last query was a search and the
// query did not change?
optpg.subscribeFormOnSubmit = async function(event) {
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
  if(utils.isElementVisible(progressElement)) {
    return false;
  }

  // Do nothing if subscription in progress
  const monitorElement = document.getElementById('submon');
  if(monitorElement && utils.isElementVisible(monitorElement)) {
    return false;
  }

  // Clear the previous results list
  const resultsListElement = document.getElementById('discover-results-list');
  resultsListElement.innerHTML  = '';

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  utils.hideElement(progressElement);

  let urlObject = null;
  try {
    urlObject = new URL(queryString);
  } catch(exception) {
  }

  // If it is a URL, subscribe
  if(urlObject) {
    queryElement.value = '';
    // TODO: this should go straight to sub, not call sub preview
    optpg.showSubscriptionPreview(urlObject);
    return false;
  }

  // Search for feeds
  utils.showElement(progressElement);

  let iconURL, linkURL, entryArray, query;
  const searchTimeout = 5000;
  try {
    ({query, entryArray} =
      await searchGoogleFeeds(queryString, searchTimeout));
  } catch(error) {
    console.debug(error);
    return false;
  } finally {
    utils.hideElement(progressElement);
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
  const distinctURLStrings = [];
  entryArray = entryArray.filter((entryObject) => {
    if(distinctURLStrings.includes(entryObject.url.href))
      return false;
    distinctURLStrings.push(entryObject.url.href);
    return true;
  });

  // If, after filtering, there are no more entries, exit early
  if(!entryArray.length) {
    utils.hideElement(resultsListElement);
    utils.showElement(noResultsElement);
    return false;
  }

  // Sanitize entry title
  // TODO: use for..of
  const entryTitleMaxLength = 200;
  entryArray.forEach((entryObject) => {
    let title = entryObject.title;
    if(title) {
      title = utils.filterControlCharacters(title);
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
      snippet = utils.filterControlCharacters(snippet);
      snippet = snippet.replace(/<br\s*>/gi, ' ');
      snippet = truncateHTML(
        snippet, entrySnippetMaxLength, replacement);
      entryObject.contentSnippet = snippet;
    }
  });

  utils.showElement(resultsListElement);
  utils.hideElement(noResultsElement);

  const itemElement = document.createElement('li');
  itemElement.textContent = `Found ${entryArray.length} feeds.`;
  resultsListElement.appendChild(itemElement);

  const fs = new FaviconService();
  await fs.db.connect();
  for(let result of entryArray) {
    if(!result.link) {
      continue;
    }
    linkURL = new URL(result.link);
    iconURL = await fs.lookup(linkURL);
    result.faviconURLString = iconURL;
  }
  fs.close();

  const elementArray = entryArray.map(utils.createSearchResultElement);
  elementArray.forEach((el) => resultsListElement.appendChild(el));
  return false;// Signal no submit
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
utils.createSearchResultElement = function(feedObject) {
  const itemElement = document.createElement('li');
  const subscribeButton = document.createElement('button');
  subscribeButton.value = feedObject.url.href;
  subscribeButton.title = feedObject.url.href;
  subscribeButton.textContent = 'Subscribe';
  subscribeButton.onclick = utils.subscribeButtonOnClick;
  itemElement.appendChild(subscribeButton);

  if(feedObject.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', feedObject.faviconURLString);
    if(feedObject.link) {
      faviconElement.setAttribute('title', feedObject.link);
    }
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.appendChild(faviconElement);
  }

  // TODO: don't allow for empty href value
  const titleElement = document.createElement('a');
  if(feedObject.link) {
    titleElement.setAttribute('href', feedObject.link);
  }
  titleElement.setAttribute('target', '_blank');
  titleElement.title = feedObject.title;
  titleElement.innerHTML = feedObject.title;
  itemElement.appendChild(titleElement);

  const snippetElement = document.createElement('span');
  snippetElement.innerHTML = feedObject.contentSnippet;
  itemElement.appendChild(snippetElement);

  const urlElement = document.createElement('span');
  urlElement.setAttribute('class', 'discover-search-result-url');
  urlElement.textContent = feedObject.url.href;
  itemElement.appendChild(urlElement);
  return itemElement;
};

utils.subscribeButtonOnClick = function(event) {
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
  if(subMonitorElement && utils.isElementVisible(subMonitorElement)) {
    return;
  }

  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feedURLObject = new URL(feedURLString);

  // TODO: this should make a call directly to the step that starts the
  // subscription process.
  optpg.showSubscriptionPreview(feedURLObject);
};

utils.removeFeedFromFeedList = function(feedIdNumber) {
  const feedElement = document.querySelector(
    `#feedlist li[feed="${feedIdNumber}"]`);

  if(!feedElement) {
    throw new Error('No feed element found with id ' + feedIdNumber);
  }

  feedElement.removeEventListener('click', optpg.feedListsItemOnClick);
  feedElement.remove();

  // Upon removing the feed, update the displayed number of feeds.
  // TODO: this should actually be called from some listener instead by a
  // BroadcastChannel message, the event should be fired by the actual
  // thing that removes the feed from storage
  optpg.updateFeedCount();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feedListElement = document.getElementById('feedlist');
  const noFeedsElement = document.getElementById('nosubs');
  if(!feedListElement.childElementCount) {
    utils.hideElement(feedListElement);
    utils.showElement(noFeedsElement);
  }
};

// TODO: visually react to unsubscribe error
utils.unsubscribeButtonOnClick = function(event) {
  const feedIdString = event.target.value;
  const feedIdNumber = parseInt(feedIdString, 10);

  let feedDbConn;
  try {
    feedDbConn = await db.connect();
    const numEntriesDeleted = await operations.unsubscribe(feedDbConn,
      feedIdNumber);
  } catch(error) {
    console.warn('Unsubscribe error:', error);
  } finally {
    if(feedDbConn) {
      feedDbConn.close();
    }
  }

  utils.removeFeedFromFeedList(feedIdNumber);
  const subsListSection = document.getElementById('subs-list-section');
  optpg.showSection(subsListSection);
};

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: after import the feeds list needs to be refreshed
// TODO: notify the user if there was an error
utils.importOPMLButtonOnClick = function(event) {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.setAttribute('accept', 'application/xml');
  uploader.onchange = jrOptionsImportOPMLUploaderOnChange;
  uploader.click();
};

async function jrOptionsImportOPMLUploaderOnChange(event) {
  const uploader = event.target;
  uploader.removeEventListener('change', jrOptionsImportOPMLUploaderOnChange);

  const importer = new OPMLImporter();
  try {
    await importer.db.connect();
    await importer.backup.importFiles(uploader.files);
  } catch(error) {
    console.debug(error);
  } finally {
    importer.close();
  }
}

// TODO: visual feedback
async function jrOptionsExportOPMLButtonOnClick(event) {

  const titleString = 'Subscriptions';
  const fileNameString = 'subscriptions.xml';

  const readerDb = new ReaderDb();
  const feedStore = new FeedStore();
  let connection;
  let feedArray;
  try {
    connection = await readerDb.db.connect();
    feedStore.conn = connection;
    feedArray = await feedStore.getAll();
  } catch(error) {
    console.warn(error);
  } finally {
    if(connection) {
      connection.close();
    }
  }

  if(!feedArray) {
    return;
  }

  backup.exportFile(feedArray, titleString, fileNameString);
}





// TODO: sort feeds alphabetically
// TODO: react to errors
async function jrOptionsInitializeSubscriptionsSection() {
  const noFeedsElement = document.getElementById('nosubs');
  const feedListElement = document.getElementById('feedlist');

  const readerDb = new ReaderDb();
  const feedStore = new FeedStore();
  let conn;
  let feedArray;
  try {
    conn = await readerDb.db.connect();
    feedStore.conn = conn;
    feedArray = await feedStore.getAll();
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(!feedArray) {
    console.warn('feeds undefined');
    return;
  }


  // Sort the feeds by title in memory using indexedDB.cmp
  feedArray.sort(function(a, b) {
    const atitle = a.title ? a.title.toLowerCase() : '';
    const btitle = b.title ? b.title.toLowerCase() : '';
    return indexedDB.cmp(atitle, btitle);
  });

  for(let feedObject of feedArray) {
    optpg.appendFeed(feedObject);

    // TODO: the update should happen as a result of call to append feed,
    // not here
    optpg.updateFeedCount();
  }

  if(!feedArray.length) {
    utils.showElement(noFeedsElement);
    utils.hideElement(feedListElement);
  } else {
    utils.hideElement(noFeedsElement);
    utils.showElement(feedListElement);
  }
}

function jrOptionsNavItemOnClick(event) {
  const clickedElement = event.target;
  const sectionElement = event.currentTarget;
  optpg.showSection(sectionElement);
}

function jrOptionsEnableNotificationsCheckboxOnClick(event) {
  if(event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}


function jrOptionsEnableBackgroundProcessingCheckboxOnClick(event) {
  if(event.target.checked) {
    chrome.permissions.request({'permissions': ['background']}, jrOptionsNoop);
  } else {
    chrome.permissions.remove({'permissions': ['background']}, jrOptionsNoop);
  }
}

function jrOptionsNoop() {
  // No operation
}


function jrOptionsEnableBackgroundProcessingOnCheckPermissions(isPermitted) {
  const checkbox = document.getElementById('enable-background');
  checkbox.checked = isPermitted;
}


function jrOptionsRestrictIdlePollingCheckboxOnClick(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}


// TODO: deprecate
function jrOptionsEnableSubscriptionPreviewCheckboxOnChange(event) {
  if(event.target.checked) {
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  } else {
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  }
}

// TODO: deprecate
function jrOptionsSubscriptionPreviewContinueButtonOnClick(event) {
  // TODO: why use currentTarget over target for no reason?
  const previewButton = event.currentTarget;
  const urlString = previewButton.value;
  optpg.hideSubscriptionPreview();

  if(!urlString) {
    console.debug('no url');
    return;
  }

  const feedURLObject = new URL(urlString);
  optpg.startSubscription(feedURLObject);
}

function jrOptionsBackgroundImageMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BACKGROUND_IMAGE = event.target.value;
  } else {
    delete localStorage.BACKGROUND_IMAGE;
  }

  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsHeaderFontMenuOnChange(event){
  const selectedOption = event.target.value;
  if(selectedOption) {
    localStorage.HEADER_FONT_FAMILY = selectedOption;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsBodyFontMenuOnChange(event) {
  if(event.target.value) {
    localStorage.BODY_FONT_FAMILY = event.target.value;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  optpg.settingsChannel.postMessage('changed');
}


function jrOptionsColumnCountMenuOnChange(event) {
  if(event.target.value) {
    localStorage.COLUMN_COUNT = event.target.value;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsEntryBackgroundColorOnInput(event) {
  const element = event.target;
  const value = element.value;
  if(value) {
    localStorage.ENTRY_BACKGROUND_COLOR = value;
  } else {
    delete localStorage.ENTRY_BACKGROUND_COLOR;
  }

  optpg.settingsChannel.postMessage('changed');
}


function jrOptionsEntryMarginOnChange(event) {
  // TODO: why am i defaulting to 10 here?
  localStorage.ENTRY_MARGIN = event.target.value || '10';

  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsHeaderFontSizeOnChange(event) {
  localStorage.HEADER_FONT_SIZE = event.target.value || '1';
  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsBodyFontSizeOnChange(event) {
  localStorage.BODY_FONT_SIZE = event.target.value || '1';
  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsJustifyCheckboxOnChange(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsBodyHeightInputOnInput(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  optpg.settingsChannel.postMessage('changed');
}

function jrOptionsOnDOMContentLoaded(event) {

  // Init CSS styles that affect the display preview area
  styleOnLoad();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const navFeedItemList = document.querySelectorAll('#navigation-menu li');
  for(let navFeedItem of navFeedItemList) {
    navFeedItem.onclick = jrOptionsNavItemOnClick;
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const enableNotificationsCheckbox = document.getElementById(
    'enable-notifications');
  enableNotificationsCheckbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  // TODO: should i be using on click or on change?
  enableNotificationsCheckbox.onclick =
    jrOptionsEnableNotificationsCheckboxOnClick;



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
    jrOptionsEnableBackgroundProcessingCheckboxOnClick;
  chrome.permissions.contains({'permissions': ['background']},
    jrOptionsEnableBackgroundProcessingOnCheckPermissions);

  const enableRestrictIdlePollingCheckbox = document.getElementById(
    'enable-idle-check');
  enableRestrictIdlePollingCheckbox.checked =
    'ONLY_POLL_IF_IDLE' in localStorage;
  // TODO: should i be using on click or on change
  enableRestrictIdlePollingCheckbox.onclick =
    jrOptionsRestrictIdlePollingCheckboxOnClick;


  // TODO: deprecate this because I plan to deprecate the preview ability.
  const jrOptionsEnableSubscriptionPreviewCheckbox =
    document.getElementById('enable-subscription-preview');
  jrOptionsEnableSubscriptionPreviewCheckbox.checked =
    'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  // TODO: should i be using on click or on change?
  jrOptionsEnableSubscriptionPreviewCheckbox.onchange =
    jrOptionsEnableSubscriptionPreviewCheckboxOnChange;

  const export_opml_btn = document.getElementById('button-export-opml');
  export_opml_btn.onclick = jrOptionsExportOPMLButtonOnClick;
  const import_opml_btn = document.getElementById('button-import-opml');
  import_opml_btn.onclick = utils.importOPMLButtonOnClick;

  jrOptionsInitializeSubscriptionsSection();

  // Init feed details section unsubscribe button click handler
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = utils.unsubscribeButtonOnClick;

  // Init the subscription form section
  const sub_form = document.getElementById('subscription-form');
  sub_form.onsubmit = optpg.subscribeFormOnSubmit;
  const continue_preview_btn = document.getElementById(
    'subscription-preview-continue');
  continue_preview_btn.onclick = jrOptionsSubscriptionPreviewContinueButtonOnClick;

  // Init display settings

  // Setup the entry background image menu
  const bg_img_menu = document.getElementById('entry-background-image');
  bg_img_menu.onchange = jrOptionsBackgroundImageMenuOnChange;

  // TODO: stop trying to reuse the option variable, create separate variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  bg_img_menu.appendChild(option);

  // Load bgimages menu
  const current_bg_image_path = localStorage.BACKGROUND_IMAGE;
  const bg_img_path_offset = '/images/'.length;
  for(let path of optpg.bgImagePathsArray) {
    let path_option = document.createElement('option');
    path_option.value = path;
    path_option.textContent = path.substring(bg_img_path_offset);
    path_option.selected = current_bg_image_path === path;
    bg_img_menu.appendChild(path_option);
  }

  // Setup header font menu
  const header_font_menu = document.getElementById('select_header_font');
  header_font_menu.onchange = jrOptionsHeaderFontMenuOnChange;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  header_font_menu.appendChild(option);
  const selected_hf = localStorage.HEADER_FONT_FAMILY;
  for(let ff of optpg.fontsArray) {
    let ff_option = document.createElement('option');
    ff_option.value = ff;
    ff_option.selected = ff === selected_hf;
    ff_option.textContent = ff;
    header_font_menu.appendChild(ff_option);
  }

  // Setup the body font menu
  const body_font_menu = document.getElementById('select_body_font');
  body_font_menu.onchange = jrOptionsBodyFontMenuOnChange;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  body_font_menu.appendChild(option);
  const current_bff = localStorage.BODY_FONT_FAMILY;
  for(let bff of optpg.fontsArray) {
    let bff_option = document.createElement('option');
    bff_option.value = bff;
    bff_option.selected = bff === current_bff;
    bff_option.textContent = bff;
    body_font_menu.appendChild(bff_option);
  }

  const col_count_element = document.getElementById('column-count');
  const col_counts = ['1', '2', '3'];
  for(let col_count of col_counts) {
    option = document.createElement('option');
    option.value = col_count;
    option.selected = col_count === localStorage.COLUMN_COUNT;
    option.textContent = col_count;
    col_count_element.appendChild(option);
  }

  col_count_element.onchange = jrOptionsColumnCountMenuOnChange;

  const bg_color_element = document.getElementById('entry-background-color');
  bg_color_element.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  bg_color_element.oninput = jrOptionsEntryBackgroundColorOnInput;

  const margin_element = document.getElementById('entry-margin');
  margin_element.value = localStorage.ENTRY_MARGIN || '10';
  margin_element.onchange = jrOptionsEntryMarginOnChange;

  const header_font_size_element = document.getElementById('header-font-size');
  header_font_size_element.value = localStorage.HEADER_FONT_SIZE || '1';
  header_font_size_element.onchange = jrOptionsHeaderFontSizeOnChange;

  const body_font_size_element = document.getElementById('body-font-size');
  body_font_size_element.value = localStorage.BODY_FONT_SIZE || '1';
  body_font_size_element.onchange = jrOptionsBodyFontSizeOnChange;

  const justify_checkbox = document.getElementById('justify-text');
  justify_checkbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justify_checkbox.onchange = jrOptionsJustifyCheckboxOnChange;

  const body_height_element = document.getElementById('body-line-height');
  const line_height_int = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  body_height_element.value = (line_height_int / 10).toFixed(2);
  body_height_element.oninput = jrOptionsBodyHeightInputOnInput;

  const manifest = chrome.runtime.getManifest();
  const ext_name_element = document.getElementById('extension-name');
  ext_name_element.textContent = manifest.name;
  const ext_version_element = document.getElementById('extension-version');
  ext_version_element.textValue = manifest.version;
  const ext_author_element = document.getElementById('extension-author');
  ext_author_element.textContent = manifest.author;
  const ext_desc_element = document.getElementById('extension-description');
  ext_desc_element.textContent = manifest.description || '';
  const ext_homepage_element = document.getElementById('extension-homepage');
  ext_homepage_element.textContent = manifest.homepage_url;

  const subsListSection = document.getElementById('subs-list-section');
  optpg.showSection(subsListSection);
}

document.addEventListener('DOMContentLoaded', jrOptionsOnDOMContentLoaded,
  {'once': true});
