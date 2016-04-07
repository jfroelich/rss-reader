// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

// Requires: /src/db.js
// Requires: /src/net.js
// Requires: /src/html.js
// Requires: /src/string.js

var options_currentMenuItem = null;
var options_currentSection = null;

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

function options_show_error(message, fadeIn) {
  'use strict';

  options_hide_error();

  const elMessage = document.createElement('span');
  elMessage.textContent = message;

  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id','options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = options_hide_error;

  const container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.appendChild(elMessage);
  container.appendChild(dismissButton);

  if(fadeIn) {
    container.style.opacity = '0';
    document.body.appendChild(container);
    fade_element(container, 1, 0);
  } else {
    container.style.display = '';
    container.style.opacity = '1';
    document.body.appendChild(container);
  }
}

// TODO: instead of removing and re-adding, reset and reuse
function options_show_sub_monitor() {
  'use strict';

  options_reset_sub_monitor();

  const container = document.createElement('div');
  container.setAttribute('id', 'options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);

  const progress = document.createElement('progress');
  progress.textContent = 'working...';
  container.appendChild(progress);
}

function options_reset_sub_monitor() {
  'use strict';
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor) {
    subMonitor.remove();
  }
}

function options_update_sub_monitor(message) {
  'use strict';

  const subMonitor = document.getElementById('options_subscription_monitor');
  if(!subMonitor) {
    return;
  }

  const messageContainer = document.createElement('p');
  messageContainer.textContent = message;
  subMonitor.appendChild(messageContainer);
}

function options_hide_sub_monitor(callback, fadeOut) {
  'use strict';

  const subMonitor = document.getElementById('options_subscription_monitor');

  if(!subMonitor) {
    if(callback) {
      callback();
      return;
    }
  }

  if(fadeOut) {
    fade_element(subMonitor, 2, 1, remove_then_call_callback);
  } else {
    remove_then_call_callback();
  }

  function remove_then_call_callback() {
    if(subMonitor) {
      subMonitor.remove();
    }

    if(callback) {
      callback();
    }
  }
}

function options_show_element(element) {
  'use strict';
  element.style.display = 'block';
}

function options_hide_element(element) {
  'use strict';
  element.style.display = 'none';
}

function options_add_class(element, classNameString) {
  'use strict';
  element.classList.add(classNameString);
}

function options_remove_class(element, classNameString) {
  'use strict';
  element.classList.remove(classNameString);
}

function options_show_section(menuItem) {
  'use strict';

  if(!menuItem || options_currentMenuItem === menuItem) {
    return;
  }

  options_add_class(menuItem, 'navigation-item-selected');

  if(options_currentMenuItem) {
    options_remove_class(options_currentMenuItem, 'navigation-item-selected');
  }

  if(options_currentSection) {
    options_hide_element(options_currentSection);
  }

  const sectionId = menuItem.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  if(sectionElement) {
    options_show_element(sectionElement);
  }

  options_currentMenuItem = menuItem;
  options_currentSection = sectionElement;
}

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

    for(var i = 0, len = currentItems.length; i < len; i++) {
      var currentKey = currentItems[i].getAttribute('sort-key');
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

  document.getElementById('subscription-preview').style.display = 'block';
  document.getElementById('subscription-preview-load-progress').style.display = 'block';
  const timeout = 10 * 1000;
  // TODO: check if already subscribed before preview?
  net_fetch_feed(url, timeout, onFetch);

  function onFetch(event, result) {
    if(event) {
      console.dir(event);
      options_hide_sub_preview();
      options_show_error('Unable to fetch' + url);
      return;
    }

    document.getElementById('subscription-preview-load-progress').style.display = 'none';
    //document.getElementById('subscription-preview-title').style.display = 'block';
    document.getElementById('subscription-preview-title').textContent =
      result.title || 'Untitled';
    document.getElementById('subscription-preview-continue').value = result.url;
    if(!result.entries || !result.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No previewable entries';
      document.getElementById('subscription-preview-entries').appendChild(item);
    }

    for(var i = 0, len = Math.min(5,result.entries.length); i < len;i++) {
      var entry = result.entries[i];
      var item = document.createElement('li');
      item.innerHTML = html_replace(entry.title, '');
      var content = document.createElement('span');
      content.innerHTML = html_replace(entry.content, '');
      item.appendChild(content);
      document.getElementById('subscription-preview-entries').appendChild(item);
    }
  }
}

function options_hide_sub_preview() {
  'use strict';
  document.getElementById('subscription-preview').style.display = 'none';
  document.getElementById('subscription-preview-entries').innerHTML = '';
}

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

  function on_open(event) {
    if(event.type !== 'success') {
      console.debug(event);
      options_hide_sub_monitor(function on_hide() {
        options_show_error(
          'An error occurred while trying to subscribe to ' + url);
      });
      return;
    }

    const connection = event.target.result;

    db_find_feed_by_url(connection, url, on_find.bind(null, connection));
  }

  function on_find(connection, event) {
    if(event.target.result) {
      options_hide_sub_monitor(function on_hide() {
        options_show_error('Already subscribed to ' + url + '.');
      });
      return;
    }

    if(!window.navigator.onLine) {
      db_store_feed(connection, null, {url: url}, onSubscribe);
    } else {
      net_fetch_feed(url, 10 * 1000, on_fetch.bind(null, connection));
    }
  }

  function on_fetch(connection, event, remoteFeed) {
    if(event) {
      console.dir(event);
      options_hide_sub_monitor(function on_hide() {
        options_show_error('An error occurred while trying to subscribe to ' +
          url);
      });
      return;
    }

    db_store_feed(connection, null, remoteFeed, function on_store(newId) {
      remoteFeed.id = newId;
      on_subscribe(remoteFeed, 0, 0);
    });
  }

  function on_subscribe(addedFeed) {
    options_append_feed(addedFeed, true);
    options_update_feed_count();
    options_update_sub_monitor('Subscribed to ' + url);
    options_hide_sub_monitor(on_hide, true);

    function on_hide() {
      const subSection = document.getElementById('mi-subscriptions');
      options_show_section(subSection);
    }

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
    console.debug('Invalid feedId');
    return;
  }

  db_open(on_open);

  function on_open(event) {
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
    document.getElementById('details-title').textContent = title;

    const favIconURL = favicon_get_url(feed.url);
    document.getElementById('details-favicon').setAttribute('src', favIconURL);

    const description = html_replace(feed.description, '');
    document.getElementById('details-feed-description').textContent =
      description;

    document.getElementById('details-feed-url').textContent = feed.url;
    document.getElementById('details-feed-link').textContent = feed.link;
    document.getElementById('details-unsubscribe').value = feed.id;
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

function options_is_element_visible(element) {
  'use strict';
  return element.style.display === 'block';
}

function options_on_subscribe_submit(event) {
  'use strict';

  // Prevent normal form submission event
  event.preventDefault();

  var query = document.getElementById('subscribe-discover-query').value;
  query = query || '';
  query = query.trim();

  if(!query) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Do nothing if still searching
  const progressElement = document.getElementById('discover-in-progress');
  if(options_is_element_visible(progressElement)) {
    return false;
  }

  // Do nothing if subscribing
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && options_is_element_visible(subMonitor)) {
    return false;
  }

  // Clear the previous results list
  document.getElementById('discover-results-list').innerHTML = '';

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  options_hide_element(progressElement);

  // If the query is a url, subscribe to the url. Otherwise, use the Google
  // Feeds api to do a search for matching feeds.
  if(url_is_valid(query)) {
    // Start subscribing
    options_hide_element(progressElement);
    document.getElementById('subscribe-discover-query').value = '';
    options_show_sub_preview(query);
  } else {
    // Show search results
    options_show_element(progressElement);
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

  // TODO: Ignore future clicks if error was displayed?
  // Ignore future clicks while subscription in progress
  const subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && options_is_element_visible(subMonitor)) {
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
    options_hide_element(progressElement);
    options_show_error('An error occurred when searching for feeds: ' +
      errorEvent);
    return;
  }

  // Searching completed, hide the progress
  options_hide_element(progressElement);

  // If there were no search results, hide the results list and show the
  // no results element and exit early.
  if(results.length < 1) {
    options_hide_element(resultsList);
    options_show_element(noResultsElement);
    return;
  }

  if(options_is_element_visible(resultsList)) {
    // Clear the previous results
    resultsList.innerHTML = '';
  } else {
    options_hide_element(noResultsElement);
    options_show_element(resultsList);
  }

  // Add an initial count as one of the list items
  const listItem = document.createElement('li');
  // TODO: use Javascript's new template feature here
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  // Generate an array of result elements to append
  const resultElements = results.map(options_create_search_result_item);

  resultElements.forEach(function append_result_item(resultElement)) {
    resultsList.appendChild(resultElement);
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
  span.setAttribute('class','discover-search-result-url');
  span.textContent = result.url;
  item.appendChild(span);

  return item;
}

function options_on_unsubscribe_click(event) {
  'use strict';
  const button = event.target;
  const buttonValue = button.value;
  const feedId = parseInt(buttonValue);

  if(!feedId) {
    console.debug('Invalid feed id:', buttonValue);
    return;
  }

  db_open(on_open);

  function on_open(event) {
    if(event.type !== 'success') {
      // TODO: show an error message
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    db_unsubscribe(connection, feedId, on_unsubscribe.bind(null, connection));
  }

  function on_unsubscribe(connection, event) {
    const sectionMenu = document.getElementById('mi-subscriptions');

    // Update the badge in case any unread articles belonged to
    // the unsubscribed feed
    badge_update_count(connection);

    // TODO: send out a message notifying other views of the unsubscribe event,
    // that way the slides view can remove any articles. Actually this should
    // be done by the unsubscribe function.

    const item = document.querySelector('feedlist li[feed="' + feedId + '"]');
    if(item) {
      item.removeEventListener('click', options_on_feed_list_item_click);
      item.remove();
    }

    // Update the count of feeds
    options_update_feed_count();

    const feedListElement = document.getElementById('feedlist');
    const noFeedsElement = document.getElementById('nosubscriptions');

    // If the feed list has no items, hide it and show a message
    if(feedListElement.childElementCount === 0) {
      options_hide_element(feedListElement);
      options_show_element(noFeedsElement);
    }

    // Switch to the main view
    options_show_section(sectionMenu);
  }
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

// TODO: onFeedsImported needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error parsing the OPML
// TODO: the user needs immediate visual feedback that we are importing
// the OPML file.
// TODO: notify the user of successful import
// TODO: switch to a different section of the options ui on complete?
function options_on_import_opml_click(event) {
  'use strict';

  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  options_hide_element(uploader);
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
  URL.revokeObjectURL(objectURL);
  anchor.remove();
  console.debug('Completed exporting %s feeds to opml file %s',
    doc.querySelectorAll('outline').length, fileName);

  // TODO: show a temporary message?
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
      options_show_element(noFeedsElement);
      options_hide_element(feedListElement);
    } else {
      options_hide_element(noFeedsElement);
      options_show_element(feedListElement);
    }
  }
}

function options_init_display_settings_section() {
  'use strict';

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
    options_show_element(navEmbedItem);
  } else {
    options_hide_element(navEmbedItem);
  }

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const navFeedItems = document.querySelectorAll('#navigation-menu li');
  for(let i = 0, len = menuItems.length; i < len; i++) {
    navFeedItems[i].onclick = options_on_nav_feed_click;
  }

  // Init the general settings page
  document.getElementById('enable-notifications').onclick =
    options_on_enable_notifications_change;

  chrome.permissions.contains({permissions: ['notifications']},
    function has_notifications_permission(permitted) {
    document.getElementById('enable-notifications').checked = permitted;
  });

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

  options_init_display_settings_section();

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
