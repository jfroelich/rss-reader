// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

// Requires: /src/db.js
// Requires: /src/dom.js
// Requires: /src/fade-element.js
// Requires: /src/favicon.js
// Requires: /src/html.js
// Requires: /src/net.js
// Requires: /src/opml.js
// Requires: /src/string.js
// Requires: /src/subscription.js
// Requires: /src/url.js

// TODO: what are these? elements? ints? use clearer names
// TODO: maybe make an OptionsMenu class and have these be member variables
let options_currentMenuItem = null;
let options_currentSection = null;

// Hides the error message
// TODO: maybe make an OptionsPageErrorMessage class and have this be
// a member function.
function options_hide_error() {
  'use strict';

  const errorMessage = document.getElementById('options_error_message');
  if(!errorMessage) {
    return;
  }

  const dismissButton = document.getElementById(
    'options_dismiss_error_button');
  if(dismissButton) {
    dismissButton.removeEventListener('click', options_hide_error);
  }

  errorMessage.remove();
}

function options_show_error(messageString, fadeIn) {
  'use strict';

  options_hide_error();

  const errorWidgetElement = document.createElement('div');
  errorWidgetElement.setAttribute('id','options_error_message');

  const messageElement = document.createElement('span');
  messageElement.textContent = messageString;
  errorWidgetElement.appendChild(messageElement);

  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id', 'options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = options_hide_error;
  errorWidgetElement.appendChild(dismissButton);

  if(fadeIn) {
    errorWidgetElement.style.opacity = '0';
    document.body.appendChild(errorWidgetElement);
    fade_element(container, 1, 0);
  } else {
    errorWidgetElement.style.opacity = '1';
    dom_show_element(errorWidgetElement);
    document.body.appendChild(errorWidgetElement);
  }
}

// TODO: instead of removing and re-adding, reset and reuse
// TODO: maybe make an OptionsSubscriptionMonitor class and have this just be
// a member function. Call it a widget.
function options_show_sub_monitor() {
  'use strict';

  options_reset_sub_monitor();

  const monitorElement = document.createElement('div');
  monitorElement.setAttribute('id', 'options_subscription_monitor');
  monitorElement.style.opacity = '1';
  document.body.appendChild(monitorElement);

  const progressElement = document.createElement('progress');
  progressElement.textContent = 'Working...';
  monitorElement.appendChild(progressElement);
}

function options_reset_sub_monitor() {
  'use strict';

  const monitorElement = document.getElementById(
    'options_subscription_monitor');
  if(monitorElement) {
    monitorElement.remove();
  }
}

function options_update_sub_monitor(messageString) {
  'use strict';

  const monitorElement = document.getElementById(
    'options_subscription_monitor');
  if(!monitorElement) {
    console.error('No element with id options_subscription_monitor found');
    return;
  }

  const messageElement = document.createElement('p');
  messageElement.textContent = messageString;
  monitorElement.appendChild(messageElement);
}

function options_hide_sub_monitor(callback, fadeOut) {
  'use strict';

  const monitorElement = document.getElementById(
    'options_subscription_monitor');

  if(!monitorElement) {
    if(callback) {
      callback();
      return;
    }
  }

  if(fadeOut) {
    fade_element(monitorElement, 2, 1, remove_then_call_callback);
  } else {
    remove_then_call_callback();
  }

  function remove_then_call_callback() {
    if(monitorElement) {
      monitorElement.remove();
    }

    if(callback) {
      callback();
    }
  }
}

function options_show_section(menuItem) {
  'use strict';

  // TODO: maybe do not check for this? Should just fail if I forgot to set it
  // somewhere.
  if(!menuItem) {
    return;
  }

  // Do nothing if not switching.
  if(options_currentMenuItem === menuItem) {
    return;
  }

  // Make the previous item appear de-selected
  if(options_currentMenuItem) {
    dom_remove_class(options_currentMenuItem, 'navigation-item-selected');
  }

  // Hide the old section
  if(options_currentSection) {
    dom_hide_element(options_currentSection);
  }

  // Make the new item appear selected
  dom_add_class(menuItem, 'navigation-item-selected');

  // Show the new section
  const sectionId = menuItem.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  if(sectionElement) {
    dom_show_element(sectionElement);
  }

  // Update the global tracking vars
  options_currentMenuItem = menuItem;
  options_currentSection = sectionElement;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function options_update_feed_count() {
  'use strict';

  const feedListElement = document.getElementById('feedlist');
  const count = feedListElement.childElementCount;

  const countElement = document.getElementById('subscription-count');
  if(count > 1000) {
    countElement.textContent = ' (999+)';
  } else {
    countElement.textContent = ' (' + count + ')';
  }
}

// TODO: rename, where is this appending?
function options_append_feed(feed, insertedSort) {
  'use strict';

  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);
  item.setAttribute('title', html_replace(feed.description) || '');
  item.onclick = options_on_feed_list_item_click;

  var favIconElement = document.createElement('img');
  favIconElement.src = favicon_get_url(feed.link);
  if(feed.title) {
    favIconElement.title = feed.title;
  }
  item.appendChild(favIconElement);

  const title = document.createElement('span');
  title.textContent = string_truncate(feed.title,300) || 'Untitled';
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
}

function options_on_enable_sub_preview_change() {
  'use strict';

  if(this.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
}

function options_show_sub_preview(url) {
  'use strict';

  options_hide_sub_preview();
  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    options_start_subscription(url);
    return;
  }

  if(!navigator.onLine) {
    options_start_subscription(url);
    return;
  }

  const previewElement = document.getElementById('subscription-preview');
  dom_show_element(previewElement);
  const progressElement = document.getElementById(
    'subscription-preview-load-progress');
  dom_show_element(progressElement);

  // TODO: check if already subscribed before preview?

  const fetchFeedTimeout = 10 * 1000;
  net_fetch_feed(url, fetchFeedTimeout, onFetch);

  function onFetch(event, result) {
    if(event) {
      console.dir(event);
      options_hide_sub_preview();
      options_show_error('Unable to fetch' + url);
      return;
    }

    const progressElement = document.getElementById(
      'subscription-preview-load-progress');
    dom_hide_element(progressElement);

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
      item.innerHTML = html_replace(entry.title, '');
      content = document.createElement('span');
      content.innerHTML = html_replace(entry.content, '');
      item.appendChild(content);
      resultsListElement.appendChild(item);
    }
  }
}

function options_hide_sub_preview() {
  'use strict';

  const previewElement = document.getElementById('subscription-preview');
  dom_hide_element(previewElement);
  const resultsListElement = document.getElementById(
    'subscription-preview-entries');

  // TODO: create and use dom_clear_element
  while(resultsListElement.firstChild) {
    resultsListElement.firstChild.remove();
  }
}

// TODO: this should be calling out to a function in subscription.js and
// delegating most of its logic to that function.
function options_start_subscription(url) {
  'use strict';

  options_hide_sub_preview();

  if(!url_is_valid(url)) {
    options_show_error('Invalid url "' + url + '".');
    return;
  }

  options_show_sub_monitor();
  options_update_sub_monitor('Subscribing...');
  db_open(on_open);

  function on_hide_monitor_show_connection_error() {
    options_show_error(
      'An error occurred while trying to subscribe to ' + url);
  }

  function on_open(event) {
    if(event.type !== 'success') {
      console.debug(event);
      options_hide_sub_monitor(on_hide_monitor_show_connection_error);
      return;
    }

    const connection = event.target.result;
    const boundOnFindFeed = on_find_feed.bind(null, connection);
    db_find_feed_by_url(connection, url, boundOnFindFeed);
  }

  function on_hide_monitor_show_exists_error() {
    options_show_error('Already subscribed to ' + url + '.');
  }

  function on_find_feed(connection, event) {
    if(event.target.result) {
      options_hide_sub_monitor(on_hide_monitor_show_exists_error);
      return;
    }

    // TODO: call out to net function
    if(!navigator.onLine) {
      db_store_feed(connection, null, {url: url}, onSubscribe);
    } else {
      const boundOnFetchFeed = on_fetch_feed.bind(null, connection);
      net_fetch_feed(url, 10 * 1000, boundOnFetchFeed);
    }
  }

  function on_hide_show_fetch_error() {
    options_show_error('An error occurred while trying to subscribe to ' +
      url);
  }

  function on_fetch_feed(connection, event, remoteFeed) {
    if(event) {
      console.dir(event);
      options_hide_sub_monitor(on_hide_show_fetch_error);
      return;
    }

    db_store_feed(connection, null, remoteFeed, on_store_feed);

    function on_store_feed(newId) {
      remoteFeed.id = newId;
      on_subscribe(remoteFeed, 0, 0);
    }
  }

  function on_hide_monitor_sub_completed() {
    const subSection = document.getElementById('mi-subscriptions');
    options_show_section(subSection);
  }

  function on_subscribe(addedFeed) {
    options_append_feed(addedFeed, true);
    options_update_feed_count();
    options_update_sub_monitor('Subscribed to ' + url);
    options_hide_sub_monitor(on_hide_monitor_sub_completed, true);

    // Show a notification
    const title = addedFeed.title || addedFeed.url;
    notification_show('Subscribed to ' + title);
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: react to connection error, find error
function populateFeedDetailsSection(feedId) {
  'use strict';

  if(!feedId) {
    console.error('Invalid feedId');
    return;
  }

  db_open(on_open_db);

  function on_open_db(event) {
    if(event.type !== 'success') {
      // TODO: show an error message?
      console.debug('Database connection error');
      return;
    }

    const connection = event.target.result;
    db_find_feed_by_id(connection, feedId, on_find_feed);
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
    title = html_replace(title, '');
    if(!title) {
      title = 'Untitled';
    }

    const titleElement = document.getElementById('details-title');
    titleElement.textContent = title;

    const favIconURL = favicon_get_url(feed.url);
    const favIconElement = document.getElementById('details-favicon');
    favIconElement.setAttribute('src', favIconURL);

    const description = html_replace(feed.description, '');
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
}

function options_on_feed_list_item_click(event) {
  'use strict';

  const element = event.currentTarget;
  const feedIdString = element.getAttribute('feed');
  const feedId = parseInt(feedIdString);

  if(isNaN(feedId)) {
    console.debug('Invalid feed id:', feedIdString);
    return;
  }

  populateFeedDetailsSection(feedId);
  // TODO: These calls should really be in an async callback
  // passed to populateFeedDetailsSection
  const feedDetailsSection = document.getElementById('mi-feed-details');
  options_show_section(feedDetailsSection);

  // Ensure the details are visible. If scrolled down when viewing large
  // list of feeds, it would otherwise not be immediately visible.
  window.scrollTo(0,0);
}

function options_on_subscribe_submit(event) {
  'use strict';

  // Prevent normal form submission event
  event.preventDefault();

  const queryElement = document.getElementById('subscribe-discover-query');

  var query = queryElement.value;
  query = query || '';
  query = query.trim();

  if(!query) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Do nothing if still searching
  const progressElement = document.getElementById('discover-in-progress');
  if(dom_is_element_visible(progressElement)) {
    return false;
  }

  // Do nothing if subscribing
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && dom_is_element_visible(subMonitor)) {
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
  dom_hide_element(progressElement);

  // If the query is a url, subscribe to the url. Otherwise, use the Google
  // Feeds api to do a search for matching feeds.
  if(url_is_valid(query)) {
    // Start subscribing
    dom_hide_element(progressElement);
    queryElement.value = '';
    options_show_sub_preview(query);
  } else {
    // Show search results
    dom_show_element(progressElement);
    google_feeds_search(query, 5000, options_on_discover_complete);
  }

  // Indicate that the normal form submit behavior should be prevented
  return false;
}

function options_on_discover_subscribe_click(event) {
  'use strict';

  const button = event.target;
  const url = button.value;
  if(!url) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && dom_is_element_visible(subMonitor)) {
    return;
  }

  options_show_sub_preview(url);
}

function options_on_discover_complete(errorEvent, query, results) {
  'use strict';

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
    dom_hide_element(progressElement);
    options_show_error('An error occurred when searching for feeds: ' +
      errorEvent);
    return;
  }

  // Searching completed, hide the progress
  dom_hide_element(progressElement);

  // If there were no search results, hide the results list and show the
  // no results element and exit early.
  if(results.length < 1) {
    dom_hide_element(resultsList);
    dom_show_element(noResultsElement);
    return;
  }

  if(dom_is_element_visible(resultsList)) {
    // Clear the previous results
    resultsList.innerHTML = '';
  } else {
    dom_hide_element(noResultsElement);
    dom_show_element(resultsList);
  }

  // Add an initial count of the number of feeds as one of the feed list items
  const listItem = document.createElement('li');
  // TODO: consider using Javascript's new template feature here
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  // Generate an array of result elements to append
  const resultElements = results.map(options_create_search_result_item);

  for(let i = 0, len = resultElements.length; i < len; i++) {
    resultsList.appendChild(resultElements[i]);
  }
}

function options_create_search_result_item(result) {
  'use strict';

  const item = document.createElement('li');

  // Create the subscribe button for the result
  const button = document.createElement('button');
  button.value = result.url;
  button.title = result.url;
  button.textContent = 'Subscribe';
  button.onclick = options_on_discover_subscribe_click;
  item.appendChild(button);

  // Show the feed's favicon
  const image = document.createElement('img');
  image.setAttribute('src', favicon_get_url(result.url));
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
}

function options_on_unsubscribe_click(event) {
  'use strict';
  const unsubscribeButton = event.target;
  const feedIdString = button.value;
  const feedId = parseInt(feedIdString, 10);

  if(!feedId || isNaN(feedId)) {
    console.error('Invalid feed id:', feedIdString);
    return;
  }

  unsubscribe(feedId, options_on_unsubscribe);
}

// TODO: do i react to the cross-window message event, or do I react
// to the immediate callback?
function options_on_unsubscribe(event) {
  'use strict';

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
      options_on_feed_list_item_click);
    feedElement.remove();
  }

  options_update_feed_count();

  // If the feed list has no items, hide it and show a message instead
  const feedListElement = document.getElementById('feedlist');
  const noFeedsElement = document.getElementById('nosubscriptions');
  if(feedListElement.childElementCount === 0) {
    dom_hide_element(feedListElement);
    dom_show_element(noFeedsElement);
  }

  // Switch to the main view
  const sectionMenu = document.getElementById('mi-subscriptions');
  options_show_section(sectionMenu);
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error parsing the OPML
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.
// TODO: switch to a different section of the options ui on complete?
function options_on_import_opml_click(event) {
  'use strict';

  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  dom_hide_element(uploader);
  uploader.onchange = on_uploader_change;
  document.body.appendChild(uploader);
  uploader.click();

  function on_uploader_change(event) {

    uploader.removeEventListener('change', on_uploader_change);

    if(!uploader.files || !uploader.files.length) {
      on_import_completed();
      return;
    }

    db_open(on_open);
  }

  function on_open(event) {

    if(event.type !== 'success') {
      // TODO: show an error message
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    opml_import_files(connection, uploader.files, on_import_completed);
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

    // TODO: notification_show because opml import no longer does this
    // itself
    // TODO: the importer should be the one responsible for sending the
    // notification, not here
    // TODO: log additional information, like the number of feeds
    // found and number actually added
    console.info('Completed opml import, imported %s of %s files',
      tracker.filesImported, tracker.numFiles);
  }
}

function options_on_export_opml_click(event) {
  'use strict';
  db_open(options_on_export_opml_click_on_open);
}

function options_on_export_opml_click_on_open(event) {
  'use strict';

  if(event.type !== 'success') {
    // TODO: visually report the error
    console.debug('Failed to connect to database when exporting opml');
    return;
  }

  const connection = event.target.result;
  db_get_all_feeds(connection, options_on_export_opml_click_on_get_feeds);
}

function options_on_export_opml_click_on_get_feeds(feeds) {
  'use strict';
  const title = 'Subscriptions';
  const doc = opml_create_document(title, feeds);

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
}

function options_on_enable_rewriting_change(event) {
  'use strict';

  const checkboxElement = event.target;
  if(checkboxElement.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
  }
}

function options_on_header_font_change(event){
  'use strict';
  if(event.target.value)
    localStorage.HEADER_FONT_FAMILY = event.target.value;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_header_font_size_change(event) {
  'use strict';
  localStorage.HEADER_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_body_font_change(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_column_count_change(event) {
  'use strict';
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_body_font_size_change(event) {
  'use strict';
  localStorage.BODY_FONT_SIZE = parseInt(event.target.value) || 1;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_body_line_height_change(event) {
  'use strict';
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_margin_change(event) {
  'use strict';
  localStorage.ENTRY_MARGIN = parseInt(event.target.value) || 10;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_background_image_change(event) {
  'use strict';
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_justify_change(event) {
  'use strict';
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  chrome.runtime.sendMessage({type: 'displaySettingsChanged'});
}

function options_on_enable_notifications_change(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['notifications']}, function() {});
  else
    chrome.permissions.remove({permissions:['notifications']}, function() {});
}

function options_on_enable_background_change(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['background']}, function() {});
  else
    chrome.permissions.remove({permissions:['background']}, function() {});
}

function options_on_enable_idle_check_change(event) {
  'use strict';
  if(event.target.checked)
    chrome.permissions.request({permissions:['idle']}, function(){});
  else
    chrome.permissions.remove({permissions:['idle']}, function(){});
}

function options_on_nav_feed_click(event) {
  'use strict';
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the event.target
  options_show_section(event.currentTarget);
}

function options_init_sub_section() {
  'use strict';

  let feedCount = 0;

  db_open(on_open);

  function on_open(event) {
    if(event.type !== 'success') {
      // TODO: react
      console.debug(event);
      return;
    }

    db_for_each_feed(event.target.result, process_feed, true,
      on_feeds_iterated);
  }

  function process_feed(feed) {
    feedCount++;
    options_append_feed(feed);
    options_update_feed_count();
  }

  function on_feeds_iterated() {
    const noFeedsElement = document.getElementById('nosubscriptions');
    const feedListElement = document.getElementById('feedlist');
    if(feedCount === 0) {
      dom_show_element(noFeedsElement);
      dom_hide_element(feedListElement);
    } else {
      dom_hide_element(noFeedsElement);
      dom_show_element(feedListElement);
    }
  }
}

function options_init(event) {
  'use strict';

  // Avoid attempts to re-init
  document.removeEventListener('DOMContentLoaded', options_init);

  // Call out to load styles because this affects the feed settings preview
  // area in the display settings section
  style_load_styles();

  // Conditionally show/hide the Allow embeds option in the left menu
  // TODO: if I am not even supporting the embed option anymore, why
  // is this still here?
  const navEmbedItem = document.getElementById('mi-embeds');
  const isAskPolicy = localStorage.EMBED_POLICY === 'ask';
  if(isAskPolicy) {
    dom_show_element(navEmbedItem);
  } else {
    dom_hide_element(navEmbedItem);
  }

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const navFeedItems = document.querySelectorAll('#navigation-menu li');
  for(let i = 0, len = navFeedItems.length; i < len; i++) {
    navFeedItems[i].onclick = options_on_nav_feed_click;
  }

  // Init the general settings page
  const enableNotificationsCheckbox = document.getElementById(
    'enable-notifications');
  enableNotificationsCheckbox.onclick = options_on_enable_notifications_change;

  function has_notifications_permission(permitted) {
    enableNotificationsCheckbox.checked = permitted;
  }

  const notificationsPermissionQuery = {'permissions': ['notifications']};
  chrome.permissions.contains(notificationsPermissionQuery,
    has_notifications_permission);

  document.getElementById('enable-background').onclick =
    options_on_enable_background_change;

  chrome.permissions.contains({permissions:['background']},
    function has_run_in_background_permission(permitted) {
    document.getElementById('enable-background').checked = permitted;
  });

  document.getElementById('enable-idle-check').onclick =
    options_on_enable_idle_check_change;

  chrome.permissions.contains({permissions:['idle']},
    function has_check_idle_permission(permitted) {
    document.getElementById('enable-idle-check').checked = permitted;
  });

  document.getElementById('enable-subscription-preview').checked =
    !!localStorage.ENABLE_SUBSCRIBE_PREVIEW;
  document.getElementById('enable-subscription-preview').onchange =
    options_on_enable_sub_preview_change;
  document.getElementById('rewriting-enable').checked =
    !!localStorage.URL_REWRITING_ENABLED;
  document.getElementById('rewriting-enable').onchange =
    options_on_enable_rewriting_change;

  // Init the opml import/export buttons
  document.getElementById('button-export-opml').onclick =
    options_on_export_opml_click;
  document.getElementById('button-import-opml').onclick =
    options_on_import_opml_click;

  options_init_sub_section();

  // Init feed details section unsubscribe button click handler
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.onclick = options_on_unsubscribe_click;

  // Init the subscription form section
  document.getElementById('subscription-form').onsubmit =
    options_on_subscribe_submit;
  document.getElementById('subscription-preview-continue').onclick =
    function on_preview_continue_click(event) {
    const url = event.currentTarget.value;
    options_hide_sub_preview();
    options_start_subscription(url);
  };

  // Init display settings
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  document.getElementById('entry-background-image').appendChild(option);

  STYLE_BACKGROUND_IMAGES.forEach(function append_bgimage_option(path) {
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/images/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE == path;
    document.getElementById('entry-background-image').appendChild(option);
  });

  document.getElementById('entry-background-image').onchange =
    options_on_background_image_change;

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_body_font').appendChild(option);

  STYLE_FONT_FAMILIES.forEach(function append_header_font_option(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  });

  STYLE_FONT_FAMILIES.forEach(function append_body_font_option(fontFamily) {
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_body_font').appendChild(option);
  });

  document.getElementById('select_header_font').onchange =
    options_on_header_font_change;
  document.getElementById('select_body_font').onchange =
    options_on_body_font_change;

  [1,2,3].forEach(function append_col_count_option(columnCount) {
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    document.getElementById('column-count').appendChild(option);
  });

  document.getElementById('column-count').onchange =
    options_on_column_count_change;

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
  document.getElementById('entry-margin').onchange = options_on_margin_change;
  document.getElementById('header-font-size').value =
    parseInt(localStorage.HEADER_FONT_SIZE) || '1';
  document.getElementById('header-font-size').onchange =
    options_on_header_font_size_change;
  document.getElementById('body-font-size').value =
    parseInt(localStorage.BODY_FONT_SIZE) || '1';
  document.getElementById('body-font-size').onchange =
    options_on_body_font_size_change;
  document.getElementById('justify-text').checked =
    (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  document.getElementById('justify-text').onchange = options_on_justify_change;
  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  document.getElementById('body-line-height').value =
    (bodyLineHeight / 10).toFixed(2);
  document.getElementById('body-line-height').oninput =
    options_on_body_line_height_change;


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
  options_show_section(document.getElementById('mi-subscriptions'));
}

document.addEventListener('DOMContentLoaded', options_init);
