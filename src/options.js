// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

let current_menu_item = null;
let current_section = null;

function hide_el(element) {
  element.style.display = 'none';
}

function show_el(element) {
  element.style.display = 'block';
}

function add_class(element, class_name) {
  element.classList.add(class_name);
}

function remove_class(element, class_name) {
  element.classList.remove(class_name);
}

function is_visible(element) {
  return element.style.display === 'block';
}

function show_error_msg(msg, should_fade_in) {
  hide_error_msg();

  const error_el = document.createElement('div');
  error_el.setAttribute('id','options_error_message');

  const msg_el = document.createElement('span');
  msg_el.textContent = msg;
  error_el.appendChild(msg_el);

  const dismiss_btn = document.createElement('button');
  dismiss_btn.setAttribute('id', 'options_dismiss_error_button');
  dismiss_btn.textContent = 'Dismiss';
  dismiss_btn.onclick = hide_error_msg;
  error_el.appendChild(dismiss_btn);

  if(should_fade_in) {
    error_el.style.opacity = '0';
    document.body.appendChild(error_el);
    fade_element(container, 1, 0);
  } else {
    error_el.style.opacity = '1';
    show_el(error_el);
    document.body.appendChild(error_el);
  }
}

// TODO: maybe make an OptionsPageErrorMessage class and have this be
// a member function.
function hide_error_msg() {
  const error_msg = document.getElementById('options_error_message');
  if(error_msg) {
    const dismiss_btn = document.getElementById('options_dismiss_error_button');
    if(dismiss_btn) {
      dismiss_btn.removeEventListener('click', hide_error_msg);
    }
    error_msg.remove();
  }
}

// TODO: instead of removing and re-adding, reset and reuse
// TODO: maybe make an OptionsSubscriptionMonitor class and have this just be
// a member function. Call it a widget.
function show_sub_monitor() {
  reset_sub_monitor();
  const monitor = document.createElement('div');
  monitor.setAttribute('id', 'options_subscription_monitor');
  monitor.style.opacity = '1';
  document.body.appendChild(monitor);
  const progress = document.createElement('progress');
  progress.textContent = 'Working...';
  monitor.appendChild(progress);
}

function reset_sub_monitor() {
  const monitor = document.getElementById('options_subscription_monitor');
  if(monitor) {
    monitor.remove();
  }
}

function append_sub_monitor_msg(msg) {
  const monitor = document.getElementById('options_subscription_monitor');
  console.assert(monitor);
  const msg_el = document.createElement('p');
  msg_el.textContent = msg;
  monitor.appendChild(msg_el);
}

function hide_sub_monitor(callback, fade_out) {
  const monitor = document.getElementById('options_subscription_monitor');
  if(!monitor) {
    if(callback) {
      callback();
      return;
    }
  }

  if(fade_out) {
    fade_element(monitor, 2, 1, remove_then_callback);
  } else {
    remove_then_callback();
  }

  function remove_then_callback() {
    if(monitor) {
      monitor.remove();
    }

    if(callback) {
      callback();
    }
  }
}

function show_section(menu_item) {
  console.assert(menu_item);

  // Do nothing if not switching.
  if(current_menu_item === menu_item) {
    return;
  }

  // Make the previous item appear de-selected
  if(current_menu_item) {
    remove_class(current_menu_item, 'navigation-item-selected');
  }

  // Hide the old section
  if(current_section) {
    hide_el(current_section);
  }

  // Make the new item appear selected
  add_class(menu_item, 'navigation-item-selected');

  // Show the new section
  const section_id = menu_item.getAttribute('section');
  const section_el = document.getElementById(section_id);
  if(section_el) {
    show_el(section_el);
  }

  // Update the global tracking vars
  current_menu_item = menu_item;
  current_section = section_el;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function update_feed_count() {
  const feed_list_el = document.getElementById('feedlist');
  const count_el = document.getElementById('subscription-count');
  const count = feed_list_el.childElementCount;
  if(count > 1000) {
    count_el.textContent = ' (999+)';
  } else {
    count_el.textContent = ' (' + count + ')';
  }
}

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.

// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
function append_feed(feed, should_sort) {
  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);

  if(feed.description) {
    item.setAttribute('title', feed.description);
  }

  item.onclick = feed_list_item_onclick;

  if(feed.faviconURLString) {
    const favicon_el = document.createElement('img');
    favicon_el.src = feed.faviconURLString;
    if(feed.title) {
      favicon_el.title = feed.title;
    }

    favicon_el.setAttribute('width', '16');
    favicon_el.setAttribute('height', '16');
    item.appendChild(favicon_el);
  }

  const title_el = document.createElement('span');
  let feed_title_string = feed.title || 'Untitled';
  feed_title_string = truncate_html(feed_title_string, 300);
  title_el.textContent = feed_title_string;
  item.appendChild(title_el);

  const feed_list_el = document.getElementById('feedlist');
  const lc_title = feed_title_string.toLowerCase();

  // Insert the feed item element into the proper position in the list
  if(should_sort) {
    let added = false;
    for(let child of feed_list_el.childNodes) {
      const key = (child.getAttribute('sort-key') || '').toLowerCase();
      if(indexedDB.cmp(lc_title, key) < 0) {
        feed_list_el.insertBefore(item, child);
        added = true;
        break;
      }
    }

    if(!added) {
      feed_list_el.appendChild(item);
    }
  } else {
    feed_list_el.appendChild(item);
  }
}

// TODO: deprecate the ability to preview
// TODO: check if already subscribed before preview?
// TODO: rename url to something like feed_url, it's not just any url
function show_sub_preview(url) {

  console.assert(Object.prototype.toString.call(url) === '[object URL]');

  hide_sub_preview();

  if(!localStorage.ENABLE_SUBSCRIBE_PREVIEW) {
    start_subscription(url);
    return;
  }

  // TODO: this check no longer makes sense, must be online in order to
  // subscribe because I removed the ability to subscribe while offline
  if('onLine' in navigator && !navigator.onLine) {
    start_subscription(url);
    return;
  }

  const preview_el = document.getElementById('subscription-preview');
  show_el(preview_el);
  const progress_el = document.getElementById(
    'subscription-preview-load-progress');
  show_el(progress_el);

  const exclude_entries = false;
  const timeout_ms = 0; //10 * 1000;

  // TODO: this is wrong
  fetch_feed(url, timeout_ms, exclude_entries, on_fetch_feed);

  function on_fetch_feed(fetch_event) {
    if(event.type !== 'success') {
      console.dir(event);
      hide_sub_preview();
      show_error_msg('Unable to fetch' + url.toString());
      return;
    }

    const progress_el = document.getElementById(
      'subscription-preview-load-progress');
    hide_el(progress_el);

    const feed = fetch_event.feed;
    const title_el = document.getElementById('subscription-preview-title');
    title_el.textContent = feed.title || 'Untitled';

    // Fetch feed generates an array of URL objects. Use the last one in the
    // list as the button's value.
    const continue_btn = document.getElementById(
      'subscription-preview-continue');
    continue_btn.value = feed.getURL().href;

    const results_list_el = document.getElementById(
      'subscription-preview-entries');

    if(!fetch_event.entries.length) {
      var item = document.createElement('li');
      item.textContent = 'No previewable entries';
      results_list_el.appendChild(item);
    }

    const limit = Math.min(5, fetch_event.entries.length);
    for(let i = 0; i < limit; i++) {
      const entry = fetch_event.entries[i];
      const item = document.createElement('li');
      item.innerHTML = replace_html(entry.title || '', '');
      const content = document.createElement('span');
      content.innerHTML = replace_html(entry.content || '', '');
      item.appendChild(content);
      results_list_el.appendChild(item);
    }
  }
}

function hide_sub_preview() {
  const preview_el = document.getElementById('subscription-preview');
  hide_el(preview_el);
  const results_list_el = document.getElementById(
    'subscription-preview-entries');
  while(results_list_el.firstChild) {
    results_list_el.firstChild.remove();
  }
}

function start_subscription(url) {
  console.assert(Object.prototype.toString.call(url) === '[object URL]');

  hide_sub_preview();
  show_sub_monitor();
  append_sub_monitor_msg('Subscribing to' + url.href);

  // TODO: if subscribing from a discover search result, I already know some
  // of the feed's other properties, such as its title and link. I should be
  // passing those along to startSubscription and setting them here. Or
  // startSubscription should expect a feed object as a parameter.

  const feed = new Feed();
  feed.add_url(url);
  subscribe(feed, {'callback': on_subscribe});

  function on_subscribe(event) {
    console.debug('on_subscribe event', event);
    if(event.type !== 'success') {
      hide_sub_monitor(show_sub_error_msg.bind(null, event.type));
      return;
    }

    // TODO: if subscription.add yields a Feed object instead of a basic
    // feed, I should just use event.feed.get_url()

    append_feed(event.feed, true);
    update_feed_count();
    append_sub_monitor_msg('Subscribed to ' +
      Feed.prototype.get_url.call(event.feed).toString());

    // Hide the sub monitor then switch back to the main feed list
    hide_sub_monitor(function() {
      const sub_el = document.getElementById('mi-subscriptions');
      show_section(sub_el);
    }, true);
  }

  function show_sub_error_msg(type) {

    console.debug('error: showing error with type', type);

    if(type === 'ConstraintError') {
      show_error_msg('Already subscribed to ' + url.href);
    } else if(type === 'FetchError') {
      show_error_msg('Failed to fetch ' + url.href);
    } else if(type === 'ConnectionError') {
      show_error_msg('Unable to connect to database');
    } else if(type === 'FetchMimeTypeError') {
      show_error_msg('The page at ' + url.href + ' is not an xml feed ' +
        '(it has the wrong content type)');
    } else {
      show_error_msg('Unknown error');
    }
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
function populate_feed_info(feed_id) {
  console.assert(!isNaN(feed_id));
  console.assert(feed_id > 0);

  const context = {'connection': null};

  open_db(on_open_db);
  function on_open_db(connection) {
    if(connection) {
      context.connection = connection;
      const transaction = connection.transaction('feed');
      const store = transaction.objectStore('feed');
      const request = store.get(feed_id);
      request.onsuccess = on_find_feed;
      request.onerror = on_find_feed;
    } else {
      // TODO: show an error message?
      console.error('Database connection error');
    }
  }

  function on_find_feed(event) {
    if(event.type !== 'success') {
      console.error(event);
      if(context.connection) {
        context.connection.close();
      }

      return;
    }

    if(!event.target.result) {
      console.error('No feed found with id', feed_id);
      if(context.connection) {
        context.connection.close();
      }
      return;
    }

    const feed = deserialize_feed(event.target.result);

    const title_el = document.getElementById('details-title');
    title_el.textContent = feed.title || 'Untitled';

    const favicon_el = document.getElementById('details-favicon');
    if(feed.faviconURLString) {
      favicon_el.setAttribute('src', feed.faviconURLString);
    } else {
      favicon_el.removeAttribute('src');
    }

    const desc_el = document.getElementById('details-feed-description');
    if(feed.description) {
      desc_el.textContent = feed.description;
    } else {
      desc_el.textContent = '';
    }

    const feed_url_el = document.getElementById('details-feed-url');
    feed_url_el.textContent = feed.get_url().toString();

    const feed_link_el = document.getElementById('details-feed-link');
    if(feed.link) {
      feed_link_el.textContent = feed.link.toString();
    } else {
      feed_link_el.textContent = '';
    }

    const unsub_btn = document.getElementById('details-unsubscribe');
    unsub_btn.value = '' + feed.id;

    if(context.connection) {
      context.connection.close();
    }
  }
}

function feed_list_item_onclick(event) {
  const element = event.currentTarget;
  const feed_id_str = element.getAttribute('feed');
  const feed_id = parseInt(feed_id_str, 10);

  // TODO: change to an assert
  if(isNaN(feed_id)) {
    console.debug('Invalid feed id:', feed_id_str);
    // TODO: react to this error
    return;
  }

  populate_feed_info(feed_id);
  // TODO: These calls should really be in an async callback
  // passed to populate_feed_info
  const feed_details_el = document.getElementById('mi-feed-details');
  show_section(feed_details_el);

  // Ensure the details are visible. If scrolled down when viewing large
  // list of feeds, it would otherwise not be immediately visible.
  window.scrollTo(0,0);
}

function sub_form_onsubmit(event) {
  // Prevent normal form submission behavior
  event.preventDefault();

  const query_el = document.getElementById('subscribe-discover-query');
  let query_string = query_el.value;
  query_string = query_string || '';
  query_string = query_string.trim();

  if(!query_string) {
    return false;
  }

  // TODO: Suppress resubmits if last query was a search and the
  // query did not change

  // Do nothing if searching in progress
  const progress_el = document.getElementById('discover-in-progress');
  if(is_visible(progress_el)) {
    return false;
  }

  // Do nothing if subscription in progress
  const monitor = document.getElementById(
    'options_subscription_monitor');
  if(monitor && is_visible(monitor)) {
    return false;
  }

  // Clear the previous results list
  const results_list_el = document.getElementById('discover-results-list');
  while(results_list_el.firstChild) {
    results_list_el.firstChild.remove();
  }

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  hide_el(progress_el);

  let url = null;
  try {
    url = new URL(query_string);
  } catch(exception) {}

  // If it is a URL, subscribe, otherwise, search
  if(url) {
    hide_el(progress_el);
    query_el.value = '';
    show_sub_preview(url);
  } else {
    // Show search results
    show_el(progress_el);
    const timeout_ms = 5000;
    search_google_feeds(query_string, timeout_ms, on_search_google_feeds);
  }

  // Indicate that the normal form submit behavior should be prevented
  return false;
}

function btn_search_onclick(event) {
  const btn = event.target;
  const feed_url_string = btn.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feed_url_string) {
    return;
  }

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const monitor = document.getElementById(
    'options_subscription_monitor');
  if(monitor && is_visible(monitor)) {
    return;
  }

  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feed_url = new URL(feed_url_string);
  // TODO: I plan to deprecate the preview step, so this should probably be
  // making a call directly to the step that starts the subscription process.
  show_sub_preview(feed_url);
}

function on_search_google_feeds(event) {
  const query = event.query;
  const results = event.entries;
  const progress_el = document.getElementById('discover-in-progress');
  const no_results_el = document.getElementById('discover-no-results');
  const results_el = document.getElementById('discover-results-list');

  // If an error occurred, hide the progress element and show an error message
  // and exit early.
  if(event.type !== 'success') {
    console.debug(event);
    hide_el(progress_el);
    show_error_msg('An error occurred when searching for feeds');
    return;
  }

  // Searching completed, hide the progress
  hide_el(progress_el);
  if(!results.length) {
    hide_el(results_el);
    show_el(no_results_el);
    return;
  }

  if(is_visible(results_el)) {
    results_el.innerHTML = '';
  } else {
    hide_el(no_results_el);
    show_el(results_el);
  }

  // Add an initial count of the number of feeds as one of the feed list items
  const item_el = document.createElement('li');
  item_el.textContent = 'Found ' + results.length + ' results.';
  results_el.appendChild(item_el);

  // Lookup the favicons for the results

  let num_favicons_processed = 0;
  for(let result of results) {
    if(result.link) {
      let link_url = null;
      try {
        link_url = new URL(result.link);
      } catch(exception) {
      }
      if(link_url) {
        lookup_favicon(link_url, null, on_lookup_favicon.bind(null, result));
      } else {
        num_favicons_processed++;
        if(num_favicons_processed === results.length) {
          on_favicons_processed();
        }
      }
    } else {
      num_favicons_processed++;
      if(num_favicons_processed === results.length) {
        on_favicons_processed();
      }
    }
  }

  if(!results.length) {
    console.debug('No results so favicon processing finished');
    on_favicons_processed();
  }

  function on_lookup_favicon(result, icon_url) {
    num_favicons_processed++;
    if(icon_url) {
      result.faviconURLString = icon_url.href;
    }

    if(num_favicons_processed === results.length) {
      on_favicons_processed();
    }
  }

  function on_favicons_processed() {
    console.debug('Finished processing favicons for search results');
    // Generate an array of result elements to append
    const result_els = results.map(create_search_result);

    // Append the result elements
    for(let i = 0, len = result_els.length; i < len; i++) {
      results_el.appendChild(result_els[i]);
    }
  }
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
 function create_search_result(feed_result) {
  const item = document.createElement('li');
  const btn = document.createElement('button');
  btn.value = feed_result.url.href;
  btn.title = feed_result.url.href;
  btn.textContent = 'Subscribe';
  btn.onclick = btn_search_onclick;
  item.appendChild(btn);

  if(feed_result.faviconURLString) {
    const favicon_el = document.createElement('img');
    favicon_el.setAttribute('src', feed_result.faviconURLString);
    if(feed_result.link) {
      favicon_el.setAttribute('title', feed_result.link);
    }
    favicon_el.setAttribute('width', '16');
    favicon_el.setAttribute('height', '16');
    item.appendChild(favicon_el);
  }

  // TODO: don't allow for empty href value
  const anchor_title = document.createElement('a');
  if(feed_result.link) {
    anchor_title.setAttribute('href', feed_result.link);
  }
  anchor_title.setAttribute('target', '_blank');
  anchor_title.title = feed_result.title;
  anchor_title.innerHTML = feed_result.title;
  item.appendChild(anchor_title);

  const span_snippet = document.createElement('span');
  span_snippet.innerHTML = feed_result.contentSnippet;
  item.appendChild(span_snippet);

  const span_url = document.createElement('span');
  span_url.setAttribute('class', 'discover-search-result-url');
  span_url.textContent = feed_result.url.href;
  item.appendChild(span_url);

  return item;
}

function unsub_btn_onclick(event) {
  console.debug('Clicked Unsubscribe');
  const feed_id = parseInt(event.target.value, 10);
  unsubscribe(feed_id, on_unsubscribe);

  function on_unsubscribe(event) {
    // If there was some failure to unsubscribe from the feed, react here
    // and then exit early and do not update the UI
    // TODO: show an error message about how there was a problem unsubscribing
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    // Remove the feed from the subscription list
    // TODO: getting the feed element from the menu should be more idiomatic,
    // I should probably be using a function here. That, or the function I
    // create that removes the feed accepts a feed_id parameter and knows how
    // to get it there.
    // TODO: removing the feed element from the menu should probably be
    // more idiomatic and use a function
    const selector = 'feedlist li[feed="' + feed_id + '"]';
    const feed_el = document.querySelector(selector);
    if(feed_el) {
      feed_el.removeEventListener('click', feed_list_item_onclick);
      feed_el.remove();
    }

    // Upon removing the feed, update the displayed number of feeds.
    // TODO: this should probably be baked into the function that removes the
    // feed or some function that handles changes to the feed list, so that
    // I do not need to call it explicitly and do not risk forgetting not to
    // call it.
    update_feed_count();

    // Upon removing the feed, update the state of the feed list.
    // If the feed list has no items, hide it and show a message instead
    // TODO: this should probably also be baked into the function that removes
    // the feed from the feed list and not the responsibility of the
    // unsubscribe function.
    const feed_list_el = document.getElementById('feedlist');
    const no_feeds_el = document.getElementById('nosubscriptions');
    if(feed_list_el.childElementCount === 0) {
      hide_el(feed_list_el);
      show_el(no_feeds_el);
    }

    // Switch back to the main view
    const section_menu = document.getElementById('mi-subscriptions');
    show_section(section_menu);
  }
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: notify the user if there was an error
// TODO: give immediate visual feedback the import started
// TODO: switch to a different section of the options ui on complete?
function import_opml_btn_onclick(event) {
  import_opml_files();
}

function export_opml_btn_onclick(event) {
  export_opml_file('Subscriptions', 'subscriptions.xml');
}

function init_subs_section() {
  let feed_count = 0;
  open_db(on_open_db);

  function on_open_db(connection) {
    if(connection) {
      // TODO: load feeds into sorted array?
      const transaction = connection.transaction('feed');
      const store = transaction.objectStore('feed');
      const index = store.index('title');
      const request = index.openCursor();
      request.onsuccess = open_cursor_onsuccess;
    } else {
      // TODO: react to error
      console.debug(event);
    }
  }

  function open_cursor_onsuccess(event) {
    const cursor = event.target.result;
    if(cursor) {
      const feed = cursor.value;
      feed_count++;
      // NOTE: this is calling append feed with a feed object loaded directly
      // from the database, which is diferent than the results of fetch
      append_feed(feed);
      update_feed_count();
      cursor.continue();
    } else {
      on_feeds_iterated();
    }
  }

  function on_feeds_iterated() {
    const no_feeds_el = document.getElementById('nosubscriptions');
    const feed_list_el = document.getElementById('feedlist');
    if(feed_count === 0) {
      show_el(no_feeds_el);
      hide_el(feed_list_el);
    } else {
      hide_el(no_feeds_el);
      show_el(feed_list_el);
    }
  }
}

function on_dom_loaded(event) {
  // Avoid attempts to re-init
  document.removeEventListener('DOMContentLoaded', on_dom_loaded);

  // Init CSS styles that affect the display preview area
  DisplaySettings.load_styles();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  // TODO: use for .. of
  const nav_feed_items = document.querySelectorAll('#navigation-menu li');
  for(let i = 0, len = nav_feed_items.length; i < len; i++) {
    nav_feed_items[i].onclick = on_nav_item_click;
  }

  // Upon clicking a feed in the feed list, switch to showing the details
  // of that feed
  // Use currentTarget instead of event.target as some of the menu items have a
  // nested element that is the desired target
  // TODO: rather than comment, use a local variable here to clarify why
  // currentTarget is more appropriate
  function on_nav_item_click(event) {
    show_section(event.currentTarget);
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const checkbox_enable_notify = document.getElementById(
    'enable-notifications');
  checkbox_enable_notify.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  checkbox_enable_notify.onclick = checkbox_enable_notify_on_change;
  function checkbox_enable_notify_on_change(event) {
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
  const checkbox_enable_bg = document.getElementById('enable-background');
  checkbox_enable_bg.onclick = checkbox_enable_bg_on_click;
  function checkbox_enable_bg_on_click(event) {
    if(event.target.checked) {
      chrome.permissions.request({'permissions': ['background']}, noop);
    }
    else {
      chrome.permissions.remove({'permissions': ['background']}, noop);
    }

    function noop() {}
  }
  chrome.permissions.contains({'permissions': ['background']},
    on_check_has_bg_perm);
  function on_check_has_bg_perm(permitted) {
    checkbox_enable_bg.checked = permitted;
  }

  const checkbox_idle = document.getElementById('enable-idle-check');
  checkbox_idle.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
  checkbox_idle.onclick = checkbox_idle_onchange;
  function checkbox_idle_onchange(event) {
    if(event.target.checked) {
      localStorage.ONLY_POLL_IF_IDLE = '1';
    } else {
      delete localStorage.ONLY_POLL_IF_IDLE;
    }
  }

  // TODO: deprecate this because I plan to deprecate the preview ability.
  const checkbox_enable_preview =
    document.getElementById('enable-subscription-preview');
  checkbox_enable_preview.checked = 'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  checkbox_enable_preview.onchange = checkbox_enable_preview_onchange;
  function checkbox_enable_preview_onchange(event) {
    if(this.checked) {
      localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
    } else {
      delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
    }
  }

  // TODO: deprecate this, url rewriting is always enabled
  const checkbox_enable_rewrite = document.getElementById('rewriting-enable');
  checkbox_enable_rewrite.checked = 'URL_REWRITING_ENABLED' in localStorage;
  checkbox_enable_rewrite.onchange = checkbox_enable_rewrite_onchange;
  function checkbox_enable_rewrite_onchange(event) {
    if(checkbox_enable_rewrite.checked) {
      localStorage.URL_REWRITING_ENABLED = '1';
    } else {
      delete localStorage.URL_REWRITING_ENABLED;
    }
  }

  // Init the opml import/export buttons
  const btn_export_opml = document.getElementById('button-export-opml');
  btn_export_opml.onclick = export_opml_btn_onclick;
  const btn_import_opml = document.getElementById('button-import-opml');
  btn_import_opml.onclick = import_opml_btn_onclick;

  init_subs_section();

  // Init feed details section unsubscribe button click handler
  const unsub_btn = document.getElementById('details-unsubscribe');
  unsub_btn.onclick = unsub_btn_onclick;

  // Init the subscription form section
  const sub_form = document.getElementById('subscription-form');
  sub_form.onsubmit = sub_form_onsubmit;
  const btn_preview_continue = document.getElementById(
    'subscription-preview-continue');
  btn_preview_continue.onclick = btn_preview_continue_onclick;

  function btn_preview_continue_onclick(event) {
    const url_string = event.currentTarget.value;
    hide_sub_preview();

    if(!url_string) {
      console.debug('no url');
      return;
    }

    const feed_url = new URL(url_string);
    start_subscription(feed_url);
  }

  // Init display settings

  // Setup the entry background image menu
  const bg_img_menu = document.getElementById('entry-background-image');
  bg_img_menu.onchange = bg_img_menu_onchange;

  function bg_img_menu_onchange(event) {
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
  bg_img_menu.appendChild(option);

  // Load and append the various background images into the menu. Set the
  // selected option.
  // TODO: this shouldn't read from the local storage variable per call
  DisplaySettings.BACKGROUND_IMAGE_PATHS.forEach(append_bg_img);
  function append_bg_img(path) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring('/images/'.length);
    option.selected = localStorage.BACKGROUND_IMAGE === path;
    bg_img_menu.appendChild(option);
  }

  // Setup the header font menu
  const header_font_menu = document.getElementById('select_header_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  document.getElementById('select_header_font').appendChild(option);

  // TODO: use a basic for loop
  DisplaySettings.FONT_FAMILIES.forEach(append_header_font);
  function append_header_font(fontFamily) {
    // TODO: option should be a local variable
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.HEADER_FONT_FAMILY;
    option.textContent = fontFamily;
    document.getElementById('select_header_font').appendChild(option);
  }
  header_font_menu.onchange = header_font_onchange;
  function header_font_onchange(event){
    if(event.target.value) {
      localStorage.HEADER_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.HEADER_FONT_FAMILY;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // Setup the body font menu
  const body_font_menu = document.getElementById('select_body_font');
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  body_font_menu.appendChild(option);
  // TODO: use a basic for loop
  DisplaySettings.FONT_FAMILIES.forEach(append_body_font);

  function append_body_font(fontFamily) {
    // TODO: use a local variable for option
    option = document.createElement('option');
    option.value = fontFamily;
    option.selected = fontFamily === localStorage.BODY_FONT_FAMILY;
    option.textContent = fontFamily;
    body_font_menu.appendChild(option);
  }
  body_font_menu.onchange = body_font_menu_onchange;
  function body_font_menu_onchange(event) {
    if(event.target.value) {
      localStorage.BODY_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.BODY_FONT_FAMILY;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const col_count_el = document.getElementById('column-count');

  // TODO: use a basic for loop here (or for .. of)
  ['1','2','3'].forEach(append_col_count);

  function append_col_count(columnCount) {
    // TODO: use a local variable here
    option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === localStorage.COLUMN_COUNT;
    option.textContent = columnCount;
    col_count_el.appendChild(option);
  }

  col_count_el.onchange = col_count_onchange;
  function col_count_onchange(event) {
    if(event.target.value) {
      localStorage.COLUMN_COUNT = event.target.value;
    } else {
      delete localStorage.COLUMN_COUNT;
    }

    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const bg_color_el = document.getElementById('entry-background-color');
  bg_color_el.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  bg_color_el.oninput = bg_color_oninput;
  function bg_color_oninput() {
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
  const margin_el = document.getElementById('entry-margin');
  margin_el.value = localStorage.ENTRY_MARGIN || '10';
  margin_el.onchange = margin_onchange;
  function margin_onchange(event) {
    // TODO: why am i defaulting to 10 here?
    localStorage.ENTRY_MARGIN = event.target.value || '10';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const header_font_size_el = document.getElementById('header-font-size');
  header_font_size_el.value = localStorage.HEADER_FONT_SIZE || '1';
  header_font_size_el.onchange = header_font_size_onchange;
  function header_font_size_onchange(event) {
    localStorage.HEADER_FONT_SIZE = event.target.value || '1';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const body_font_size_el = document.getElementById('body-font-size');
  body_font_size_el.value = localStorage.BODY_FONT_SIZE || '1';
  body_font_size_el.onchange = body_font_size_onchange;
  function body_font_size_onchange(event) {
    localStorage.BODY_FONT_SIZE = event.target.value || '1';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const checkbox_justify = document.getElementById('justify-text');
  checkbox_justify.checked = 'JUSTIFY_TEXT' in localStorage;
  checkbox_justify.onchange = checkbox_justify_onchange;
  function checkbox_justify_onchange(event) {
    if(event.target.checked) {
      localStorage.JUSTIFY_TEXT = '1';
    } else {
      delete localStorage.JUSTIFY_TEXT;
    }
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  const line_height_el = document.getElementById('body-line-height');
  const line_height = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  line_height_el.value = (line_height / 10).toFixed(2);
  line_height_el.oninput = line_height_onchange;
  function line_height_onchange(event) {
    localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
    chrome.runtime.sendMessage({'type': 'displaySettingsChanged'});
  }

  // Init the about section
  const manifest = chrome.runtime.getManifest();
  const ext_name_el = document.getElementById('extension-name');
  ext_name_el.textContent = manifest.name;
  const ext_version_el = document.getElementById('extension-version');
  ext_version_el.textValue = manifest.version;
  const ext_author_el = document.getElementById('extension-author');
  ext_author_el.textContent = manifest.author;
  const ext_desc_el = document.getElementById('extension-description');
  ext_desc_el.textContent = manifest.description || '';
  const ext_homepage_el = document.getElementById('extension-homepage');
  ext_homepage_el.textContent = manifest.homepage_url;

  // Initially show the subscriptions list
  const sub_list_el = document.getElementById('mi-subscriptions');
  show_section(sub_list_el);
}

document.addEventListener('DOMContentLoaded', on_dom_loaded);

} // End file block scope
