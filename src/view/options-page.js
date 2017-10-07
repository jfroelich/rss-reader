(function(exports) {
'use strict';

function settings_channel_onmessage(event) {
  if(event.data === 'changed')
    update_entry_css_rules(event);
}

const settings_channel = new BroadcastChannel('settings');
settings_channel.onmessage = settings_channel_onmessage;

// Navigation tracking
let current_menu_item = null;
let current_section_element = null;

function show_error_msg(msg, should_fade_in) {
  hide_error_msg();

  const error_element = document.createElement('div');
  error_element.setAttribute('id','options_error_message');

  const msg_element = document.createElement('span');
  msg_element.textContent = msg;
  error_element.appendChild(msg_element);

  const dismiss_error_button = document.createElement('button');
  dismiss_error_button.setAttribute('id', 'dismiss-error-button');
  dismiss_error_button.textContent = 'Dismiss';
  dismiss_error_button.onclick = hide_error_msg;
  error_element.appendChild(dismiss_error_button);

  if(should_fade_in) {
    error_element.style.opacity = '0';
    document.body.appendChild(error_element);
    fade_element(container, 1,0);
  } else {
    error_element.style.opacity = '1';
    show_element(error_element);
    document.body.appendChild(error_element);
  }
}

function hide_error_msg() {
  const error_msg_element = document.getElementById('options_error_message');
  if(error_msg_element) {
    const dismiss_error_button =
      document.getElementById('dismiss-error-button');
    if(dismiss_error_button)
      dismiss_error_button.removeEventListener('click', hide_error_msg);
    error_msg_element.remove();
  }
}

// TODO: instead of removing and re-adding, reset and reuse
function show_subscription_monitor() {
  let monitor_element = document.getElementById('submon');
  if(monitor_element) {
    monitor_element.remove();
  }

  monitor_element = document.createElement('div');
  monitor_element.setAttribute('id', 'submon');
  monitor_element.style.opacity = '1';
  document.body.appendChild(monitor_element);

  const progress_element = document.createElement('progress');
  progress_element.textContent = 'Working...';
  monitor_element.appendChild(progress_element);
}

function append_subscription_monitor_msg(msg) {
  const msg_element = document.createElement('p');
  msg_element.textContent = msg;
  const monitor_element = document.getElementById('submon');
  monitor_element.appendChild(msg_element);
}

function show_section(menu_item_element) {
  ASSERT(menu_item_element);

  if(current_menu_item === menu_item_element)
    return;

  // Make the previous item appear de-selected
  if(current_menu_item)
    remove_element_class(current_menu_item, 'navigation-item-selected');

  // Hide the old section
  if(current_section_element)
    hide_element(current_section_element);

  // Make the new item appear selected
  add_element_class(menu_item_element, 'navigation-item-selected');

  // Show the new section
  const section_id_string = menu_item_element.getAttribute('section');
  const section_element = document.getElementById(section_id_string);

  ASSERT(section_element, 'No matching section for id ' + section_id_string);

  show_element(section_element);

  // Update the global tracking vars
  current_menu_item = menu_item_element;
  current_section_element = section_element;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function update_feed_count() {
  const feed_list_element = document.getElementById('feedlist');
  const count = feed_list_element.childElementCount;
  const feed_count_element = document.getElementById('subscription-count');
  if(count > 1000)
    feed_count_element.textContent = ' (999+)';
  else
    feed_count_element.textContent = ` (${count})`;
}

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.
// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object. Use a clearer name.
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
function append_feed_to_feed_list(feed, should_maintain_order) {
  const item_element = document.createElement('li');
  item_element.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item_element.setAttribute('feed', feed.id);
  if(feed.description)
    item_element.setAttribute('title', feed.description);
  item_element.onclick = feed_list_item_onclick;

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.src = feed.faviconURLString;
    if(feed.title)
      favicon_element.title = feed.title;
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item_element.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  let feed_title = feed.title || 'Untitled';
  feed_title = html_truncate(feed_title, 300);
  title_element.textContent = feed_title;
  item_element.appendChild(title_element);
  const feed_list_element = document.getElementById('feedlist');
  const normal_title = feed_title.toLowerCase();

  if(!should_maintain_order) {
    feed_list_element.appendChild(item_element);
    return;
  }

  // Insert the feed element into the proper position in the list
  let did_insert_element = false;
  for(const child_node of feed_list_element.childNodes) {
    const key_string =
      (child_node.getAttribute('sort-key') || '').toLowerCase();
    if(indexedDB.cmp(normal_title, key_string) < 1) {
      feed_list_element.insertBefore(item_element, child_node);
      did_insert_element = true;
      break;
    }
  }

  if(!did_insert_element)
    feed_list_element.appendChild(item_element);
}

function hide_subscription_preview() {
  const preview_element = document.getElementById('subscription-preview');
  hide_element(preview_element);
  const results_list_element = document.getElementById(
    'subscription-preview-entries');
  while(results_list_element.firstChild)
    results_list_element.firstChild.remove();
}

// TODO: if subscribing from a discover search result, I already know some
// of the feed's other properties, such as its title and link. I should be
// passing those along to start_subscription and setting them here. Or
// start_subscription should expect a feed object as a parameter.
async function start_subscription(url_object) {

  console.debug('Starting subscription to', url_object.href);

  // TODO: remove this once preview is deprecated more fully
  hide_subscription_preview();

  show_subscription_monitor();
  append_subscription_monitor_msg(`Subscribing to ${url_object.href}`);

  const feed = {};
  feed_append_url(feed, url_object.href);
  const options = {};
  options.verbose = true;// temp
  // Leaving other options to defaults for now
  let subscribed_feed;
  let reader_conn;
  let icon_conn;
  const verbose = true; // temp, for now
  let icon_db_name, icon_db_version, connect_timeout_ms;
  let subscribe_timeout_ms, mute_notifications;

  // TODO: make this into a helper function that opens both connections
  const icon_conn_promise = favicon.open(icon_db_name, icon_db_version,
    connect_timeout_ms, verbose);
  const reader_conn_promise = reader_db.open();
  const conn_promises = [reader_conn_promise, icon_conn_promise];
  const conn_promise = Promise.all(conn_promises);

  try {
    const conn_resolutions = await conn_promise;
    reader_conn = conn_resolutions[0];
    icon_conn = conn_resolutions[1];

    // TODO: rather than throw, move the subfeed = subresult.feed stuff
    // to after the try/catch
    const sub_result = await sub_add(feed, reader_conn, icon_conn,
      subscribe_timeout_ms, mute_notifications);

    if(sub_result.status !== subscription.OK)
      throw new Error('subscription result not ok: ' + sub_result.status);

    subscribed_feed = sub_result.feed;

  } catch(error) {
    DEBUG(error);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  // TODO: is it correct to return here? shouldn't this be visible error or
  // something? Also, still need to cleanup the subscription monitor.
  // TODO: this should be in the catch block above
  if(!subscribed_feed) {
    // TODO: this should be a call to a helper function
    const monitor_element = document.getElementById('submon');
    await fade_element(monitor_element, 2, 1);
    monitor_element.remove();

    // TODO: show an error message.
    // TODO: return an error code?
    return;
  }

  // TODO: what is the second parameter? give it an express name here
  append_feed_to_feed_list(subscribed_feed, true);

  // TODO: rather than expressly updating the feed count here, this should
  // happen as a result of some update event that some listener reacts to
  // That event should probably be a BroadcastChannel message that is fired
  // by subscribe
  update_feed_count();

  // Show a brief message that the subscription was successful
  const feed_url_string = feed_get_top_url(subscribed_feed);
  append_subscription_monitor_msg(`Subscribed to ${feed_url_string}`);

  // Hide the sub monitor
  // TODO: this should be a call to a helper function
  const monitor_element = document.getElementById('submon');
  // TODO: the other parameters should be named expressly
  await fade_element(monitor_element, 2, 1);
  monitor_element.remove();

  // After subscribing switch back to the feed list
  const subs_section_element = document.getElementById('subs-list-section');
  show_section(subs_section_element);
}


// TODO: inline this
async function db_connect_then_find_feed_by_id(feed_id) {
  let conn;
  try {
    conn = await reader_db.open();
    return await reader_db.find_feed_by_id(conn, feed_id);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
// TODO: should this even catch?
async function feed_list_item_onclick(event) {

  // Use current target to capture the element with the feed attribute
  const feed_list_item_element = event.currentTarget;
  const feed_id_string = feed_list_item_element.getAttribute('feed');
  const feed_id_number = parseInt(feed_id_string, 10);

  if(isNaN(feed_id_number)) {
    // TODO: throw? visible error?
    console.error('feed_id_number is nan, parsed from ' + feed_id_string);
    return;
  }

  const feed = await db_connect_then_find_feed_by_id(feed_id_number);

  // TODO: should this throw?
  if(!feed) {
    console.error('No feed found with id', feed_id_number);
    return;
  }

  const title_element = document.getElementById('details-title');
  title_element.textContent = feed.title || feed.link || 'Untitled';

  const favicon_element = document.getElementById('details-favicon');
  if(feed.faviconURLString)
    favicon_element.setAttribute('src', feed.faviconURLString);
  else
    favicon_element.removeAttribute('src');

  const description_element = document.getElementById(
    'details-feed-description');
  if(feed.description)
    description_element.textContent = feed.description;
  else
    description_element.textContent = '';

  const feed_url_element = document.getElementById('details-feed-url');
  feed_url_element.textContent = feed_get_top_url(feed);
  const feed_link_element = document.getElementById('details-feed-link');
  feed_link_element.textContent = feed.link || '';
  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.value = '' + feed.id;

  const details_element = document.getElementById('mi-feed-details');
  show_section(details_element);

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
async function subscribe_form_on_submit(event) {
  // Prevent normal form submission behavior
  event.preventDefault();

  const query_element = document.getElementById('subscribe-discover-query');
  let query_string = query_element.value;
  query_string = query_string || '';
  query_string = query_string.trim();

  if(!query_string) {
    console.debug('canceling submit, query is empty');
    return false;
  }

  const no_results_element = document.getElementById('discover-no-results');

  // Do nothing if searching in progress
  const progress_element = document.getElementById('discover-in-progress');

  // BUG: progress_element.style.display is empty when I expect it to be
  // 'none'. I specified #discover-in-progress { display: none; } in options.css
  // if(is_visible_element(progress_element)){
  if(progress_element.style.display === 'block') {
    console.debug('canceling submit event, search in progress');
    return false;
  }

  // Do nothing if subscription in progress
  const monitor_element = document.getElementById('submon');
  if(monitor_element && is_visible_element(monitor_element)) {
    console.debug('canceling submit, subscription in progress');
    return false;
  }

  // Clear the previous results list
  const results_list_element = document.getElementById('discover-results-list');
  results_list_element.innerHTML  = '';

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  hide_element(progress_element);

  let url_object = null;
  try {
    url_object = new URL(query_string);
  } catch(exception) {
  }

  // If it is a URL, subscribe
  if(url_object) {
    console.debug('form submit detected url input, not doing search');
    query_element.value = '';

    start_subscription(url_object);
    return false;
  }

  // Search for feeds
  show_element(progress_element);

  // TODO: are these vars objects or strings? rename to clarify
  let icon_url, link_url, entries, query;
  const search_timeout_ms = 5000;

  // TODO: avoid destructuring

  try {
    ({query, entries} =
      await search_google_feeds(query_string, search_timeout_ms));
  } catch(error) {
    console.debug(error);
    return false;
  } finally {
    hide_element(progress_element);
  }

  // TODO: do i need to still hide progress element then?

  // TODO: use explicit loops

  // Filter entries without urls
  entries = entries.filter((entry_object) => entry_object.url);

  // Convert to URL objects, filter entries with invalid urls
  entries = entries.filter((entry_object) => {
    try {
      entry_object.url = new URL(entry_object.url);
      return true;
    } catch(error) {
      return false;
    }
  });

  // Filter entries with identical normalized urls, favoring earlier entries
  // TODO: use a Set?
  const distinct_urls = [];
  entries = entries.filter((entry_object) => {
    if(distinct_urls.includes(entry_object.url.href))
      return false;
    distinct_urls.push(entry_object.url.href);
    return true;
  });

  // If, after filtering, there are no more entries, exit early
  if(!entries.length) {
    hide_element(results_list_element);
    show_element(no_results_element);
    return false;
  }

  // Sanitize entry title
  // TODO: use for..of
  const entry_title_max_length = 200;
  entries.forEach((entry_object) => {
    let title = entry_object.title;
    if(title) {
      title = string_filter_control_chars(title);
      title = html_replace_tags(title, '');
      title = html_truncate(title, entry_title_max_length);
      entry_object.title = title;
    }
  });

  // Sanitize content snippet
  const replacement_string = '\u2026';
  const entry_snippet_max_length = 400;
  // TODO: use for..of
  entries.forEach((entry_object) => {
    let snippet = entry_object.contentSnippet;
    if(snippet) {
      snippet = string_filter_control_chars(snippet);
      snippet = snippet.replace(/<br\s*>/gi, ' ');
      snippet = html_truncate(
        snippet, entry_snippet_max_length, replacement_string);
      entry_object.contentSnippet = snippet;
    }
  });

  show_element(results_list_element);
  hide_element(no_results_element);

  const item_element = document.createElement('li');
  item_element.textContent = `Found ${entries.length} feeds.`;
  results_list_element.appendChild(item_element);

  // TODO: use try/catch

  let icon_conn;

  icon_conn = await favicon.open();
  for(let result of entries) {
    if(!result.link)
      continue;

    link_url = new URL(result.link);
    // TODO: properly call with all parameteres
    icon_url = await lookup_favicon(icon_conn, link_url);
    result.faviconURLString = icon_url;
  }
  icon_conn.close();

  // TODO: use explicit loops
  const elements = entries.map(create_search_result_element);
  elements.forEach((el) => results_list_element.appendChild(el));
  return false;// Signal no submit
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
function create_search_result_element(feed) {
  const item_element = document.createElement('li');
  const subscribe_button = document.createElement('button');
  subscribe_button.value = feed.url.href;
  subscribe_button.title = feed.url.href;
  subscribe_button.textContent = 'Subscribe';
  subscribe_button.onclick = subscribe_button_on_click;
  item_element.appendChild(subscribe_button);

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', feed.faviconURLString);
    if(feed.link)
      favicon_element.setAttribute('title', feed.link);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item_element.appendChild(favicon_element);
  }

  // TODO: don't allow for empty href value
  const title_element = document.createElement('a');
  if(feed.link)
    title_element.setAttribute('href', feed.link);
  title_element.setAttribute('target', '_blank');
  title_element.title = feed.title;
  title_element.innerHTML = feed.title;
  item_element.appendChild(title_element);

  const snippet_element = document.createElement('span');
  snippet_element.innerHTML = feed.contentSnippet;
  item_element.appendChild(snippet_element);

  const url_element = document.createElement('span');
  url_element.setAttribute('class', 'discover-search-result-url');
  url_element.textContent = feed.url.href;
  item_element.appendChild(url_element);
  return item_element;
}

function subscribe_button_on_click(event) {
  const subscribe_button = event.target;
  const feed_url_string = subscribe_button.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feed_url_string)
    return;

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const sub_monitor_element = document.getElementById('submon');
  if(sub_monitor_element && is_visible_element(sub_monitor_element))
    return;

  // Should never throw
  const feed_url_object = new URL(feed_url_string);

  // TODO: this should make a call directly to the step that starts the
  // subscription process.
  start_subscription(feed_url_object);
}

function remove_feed_from_feed_list(feed_id_number) {
  const feed_element = document.querySelector(
    `#feedlist li[feed="${feed_id_number}"]`);

  ASSERT(feed_element, 'no feed with id ' + feed_id_number);

  feed_element.removeEventListener('click', feed_list_item_onclick);
  feed_element.remove();

  // Upon removing the feed, update the displayed number of feeds.
  // TODO: this should actually be called from some listener instead by a
  // BroadcastChannel message, the event should be fired by the actual
  // thing that removes the feed from storage
  update_feed_count();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feed_list_element = document.getElementById('feedlist');
  const no_feeds_element = document.getElementById('nosubs');
  if(!feed_list_element.childElementCount) {
    hide_element(feed_list_element);
    show_element(no_feeds_element);
  }
}

// TODO: visually react to unsubscribe error
async function unsubscribe_button_on_click(event) {
  const feed_id_string = event.target.value;
  const radix = 10;
  const feed_id_number = parseInt(feed_id_string, radix);

  if(isNaN(feed_id_number)) {
    // TODO: throw? show error?
    DEBUG('feed_id_number is nan, parsed from ' + feed_id_string);
    return;
  }

  let reader_conn;
  try {
    reader_conn = await reader_db.open();
    const num_entries_deleted = await sub_remove(feed_id_number,
      reader_conn);
  } catch(error) {
    DEBUG(error);
  } finally {
    if(reader_conn)
      reader_conn.close();
  }

  remove_feed_from_feed_list(feed_id_number);
  const subs_list_section = document.getElementById('subs-list-section');
  show_section(subs_list_section);
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: after import the feeds list needs to be refreshed
// TODO: notify the user if there was an error
function import_opml_button_on_click(event) {
  console.log('Creating hidden file uploader element');

  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'application/xml');

  console.debug('Adding change listener to file input');
  uploader_input.addEventListener('change', import_opml_uploader_on_change);

  console.log('Pseudo-clicking hidden file uploader element');
  uploader_input.click();
}

// TODO: visual feedback in event an error
async function import_opml_uploader_on_change(event) {

  // Testing bug
  console.log('Received event', event);


  const verbose = true;
  const uploader_input = event.target;

  if(verbose)
    console.log('import_opml_uploader_on_change event', event);

  try {
    await import_opml_files(uploader_input.files, verbose);
  } catch(error) {
    console.warn(error);
  }

  // TODO: need to update feed list for each added feed
  // Maybe something like 'refresh feed list' would be easier than incrementally
  // updating it
}

// TODO: visual feedback in event of an error
async function export_opml_button_onclick(event) {
  const title = 'Subscriptions';
  const file_name = 'subscriptions.xml';

  try {
    await opml_export(title, file_name);
  } catch(error) {
    console.warn(error);
  }
}

// TODO: sort feeds alphabetically
// TODO: react to errors
async function init_subscriptions_section() {
  const no_feeds_element = document.getElementById('nosubs');
  const feed_list_element = document.getElementById('feedlist');
  let conn;
  let feeds;
  try {
    conn = await reader_db.open();
    feeds = await reader_db.get_feeds(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(!feeds) {
    console.warn('feeds undefined');
    return;
  }

  // Ensure feeds have titles
  for(const feed of feeds) {
    feed.title = feed.title || feed.link || 'Untitled';
  }

  // Sort the feeds by title using indexedDB.cmp
  feeds.sort(function(a, b) {
    const atitle = a.title ? a.title.toLowerCase() : '';
    const btitle = b.title ? b.title.toLowerCase() : '';
    return indexedDB.cmp(atitle, btitle);
  });

  for(let feed of feeds) {
    append_feed_to_feed_list(feed);
    // TODO: the update should happen as a result of call to append feed,
    // not here
    update_feed_count();
  }

  if(!feeds.length) {
    show_element(no_feeds_element);
    hide_element(feed_list_element);
  } else {
    hide_element(no_feeds_element);
    show_element(feed_list_element);
  }
}

function nav_item_on_click(event) {
  const clickedElement = event.target;
  const section_element = event.currentTarget;
  show_section(section_element);
}

// TODO: this should be on change
function enable_notifications_checkbox_on_click(event) {
  if(event.target.checked)
    localStorage.SHOW_NOTIFICATIONS = '1';
  else
    delete localStorage.SHOW_NOTIFICATIONS;
}

// TODO: this should be on change
function enable_bg_processing_checkbox_on_click(event) {
  if(event.target.checked)
    chrome.permissions.request({'permissions': ['background']}, noop);
  else
    chrome.permissions.remove({'permissions': ['background']}, noop);
}

function noop() {
  // No operation
}

// TODO: use a promise and an async function call instead of this separate
// helper, create a utility function for checking permission that returns a
// promise
function enable_bg_processing_on_check_permission(is_permitted) {
  const checkbox = document.getElementById('enable-background');
  checkbox.checked = is_permitted;
}

// TODO: should this be on change instead of on click?
function restrict_idle_polling_checkbox_on_click(event) {
  if(event.target.checked)
    localStorage.ONLY_POLL_IF_IDLE = '1';
  else
    delete localStorage.ONLY_POLL_IF_IDLE;
}

// TODO: deprecate
function enable_subscription_preview_checkbox_on_change(event) {
  if(event.target.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
}

// TODO: deprecate
function subscription_preview_continue_button_on_click(event) {
  // TODO: why use currentTarget over target for no reason?
  const preview_button = event.currentTarget;
  const url_string = preview_button.value;
  hide_subscription_preview();

  if(!url_string) {
    console.debug('no url');
    return;
  }

  const feed_url_object = new URL(url_string);
  start_subscription(feed_url_object);
}

function background_img_menu_on_change(event) {
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  settings_channel.postMessage('changed');
}

function header_font_menu_on_change(event){
  const selected_option = event.target.value;
  if(selected_option)
    localStorage.HEADER_FONT_FAMILY = selected_option;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  settings_channel.postMessage('changed');
}

function body_font_menu_on_change(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;
  settings_channel.postMessage('changed');
}

function column_count_menu_on_change(event) {
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
  settings_channel.postMessage('changed');
}

function entry_bg_color_input_on_input(event) {
  const value = event.target.value;
  if(value)
    localStorage.ENTRY_BACKGROUND_COLOR = value;
  else
    delete localStorage.ENTRY_BACKGROUND_COLOR;
  settings_channel.postMessage('changed');
}

function entry_margin_slider_on_change(event) {
  // TODO: why am i defaulting to 10 here?
  localStorage.ENTRY_MARGIN = event.target.value || '10';
  settings_channel.postMessage('changed');
}

function header_font_size_slider_on_change(event) {
  localStorage.HEADER_FONT_SIZE = event.target.value || '1';
  settings_channel.postMessage('changed');
}

function body_font_size_slider_on_change(event) {
  localStorage.BODY_FONT_SIZE = event.target.value || '1';
  settings_channel.postMessage('changed');
}

function justify_text_checkbox_on_change(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  settings_channel.postMessage('changed');
}

function body_height_input_on_input(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  settings_channel.postMessage('changed');
}

// TODO: this could use some cleanup or at least some clarifying comments
function fade_element(element, duration_secs, delay_secs) {
  function resolver(resolve, reject) {
    const style = element.style;
    if(style.display === 'none') {
      style.display = '';
      style.opacity = '0';
    }

    if(!style.opacity)
      style.opacity = style.display === 'none' ? '0' : '1';

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${duration_secs}s ease ${delay_secs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  }
  return new Promise(resolver);
}

document.addEventListener('DOMContentLoaded', function on_dcl(event) {

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

  const img_paths = [
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
  add_entry_css_rules();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const nav_feed_item_list = document.querySelectorAll('#navigation-menu li');
  for(const nav_feed_item of nav_feed_item_list)
    nav_feed_item.onclick = nav_item_on_click;

  // Setup the Enable Notifications checkbox in the General Settings section
  const enable_notifications_checkbox = document.getElementById(
    'enable-notifications');
  enable_notifications_checkbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  // TODO: on change
  enable_notifications_checkbox.onclick =
    enable_notifications_checkbox_on_click;

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.
  // TODO: should this be onchange or onclick? I had previously named the
  // function onchange but was listening to onclick
  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API ?
  const enable_bg_processing_checkbox = document.getElementById(
    'enable-background');
  // TODO: should i be using on click or on change?
  enable_bg_processing_checkbox.onclick =
    enable_bg_processing_checkbox_on_click;
  chrome.permissions.contains({'permissions': ['background']},
    enable_bg_processing_on_check_permission);

  const enable_restrict_idle_polling_checkbox = document.getElementById(
    'enable-idle-check');
  enable_restrict_idle_polling_checkbox.checked =
    'ONLY_POLL_IF_IDLE' in localStorage;
  // TODO: on change
  enable_restrict_idle_polling_checkbox.onclick =
    restrict_idle_polling_checkbox_on_click;

  // TODO: deprecate this because I plan to deprecate the preview ability.
  const enable_subscription_preview_checkbox =
    document.getElementById('enable-subscription-preview');
  enable_subscription_preview_checkbox.checked =
    'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  // TODO: should i be using on click or on change?
  enable_subscription_preview_checkbox.onchange =
    enable_subscription_preview_checkbox_on_change;

  const export_opml_button = document.getElementById('button-export-opml');
  export_opml_button.onclick = export_opml_button_onclick;
  const import_opml_button = document.getElementById('button-import-opml');
  import_opml_button.onclick = import_opml_button_on_click;

  init_subscriptions_section();

  // Init feed details section unsubscribe button click handler
  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.onclick = unsubscribe_button_on_click;

  // Init the subscription form section
  const subscription_form = document.getElementById('subscription-form');
  subscription_form.onsubmit = subscribe_form_on_submit;
  const continue_preview_button = document.getElementById(
    'subscription-preview-continue');
  continue_preview_button.onclick = subscription_preview_continue_button_on_click;

  // Init display settings

  // Setup the entry background image menu
  const background_image_menu = document.getElementById(
    'entry-background-image');
  background_image_menu.onchange = background_img_menu_on_change;

  // TODO: stop trying to reuse the option variable, create separate variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  background_image_menu.appendChild(option);

  // Load bgimages menu
  const current_bg_img_path = localStorage.BACKGROUND_IMAGE;
  const bg_img_path_offset = '/images/'.length;
  for(const path of img_paths) {
    let path_option = document.createElement('option');
    path_option.value = path;
    path_option.textContent = path.substring(bg_img_path_offset);
    path_option.selected = current_bg_img_path === path;
    background_image_menu.appendChild(path_option);
  }

  const header_font_menu = document.getElementById('select_header_font');
  header_font_menu.onchange = header_font_menu_on_change;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  header_font_menu.appendChild(option);
  const current_header_font = localStorage.HEADER_FONT_FAMILY;
  for(const font of fonts) {
    let header_font_option = document.createElement('option');
    header_font_option.value = font;
    header_font_option.selected = font === current_header_font;
    header_font_option.textContent = font;
    header_font_menu.appendChild(header_font_option);
  }

  const body_font_menu = document.getElementById('select_body_font');
  body_font_menu.onchange = body_font_menu_on_change;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  body_font_menu.appendChild(option);
  const current_body_font = localStorage.BODY_FONT_FAMILY;
  for(const body_font of fonts) {
    let body_font_option = document.createElement('option');
    body_font_option.value = body_font;
    body_font_option.selected = body_font === current_body_font;
    body_font_option.textContent = body_font;
    body_font_menu.appendChild(body_font_option);
  }

  const column_count_element = document.getElementById('column-count');
  column_count_element.onchange = column_count_menu_on_change;
  const column_counts = ['1', '2', '3'];
  const current_column_count = localStorage.COLUMN_COUNT
  for(const column_count of column_counts) {
    option = document.createElement('option');
    option.value = column_count;
    option.selected = column_count === current_column_count;
    option.textContent = column_count;
    column_count_element.appendChild(option);
  }

  const bg_color_input = document.getElementById('entry-background-color');
  bg_color_input.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  bg_color_input.oninput = entry_bg_color_input_on_input;

  const margin_input = document.getElementById('entry-margin');
  margin_input.value = localStorage.ENTRY_MARGIN || '10';
  margin_input.onchange = entry_margin_slider_on_change;

  const header_font_size_input = document.getElementById('header-font-size');
  header_font_size_input.value = localStorage.HEADER_FONT_SIZE || '1';
  header_font_size_input.onchange = header_font_size_slider_on_change;

  const body_font_size_input = document.getElementById('body-font-size');
  body_font_size_input.value = localStorage.BODY_FONT_SIZE || '1';
  body_font_size_input.onchange = body_font_size_slider_on_change;

  const justify_text_checkbox = document.getElementById('justify-text');
  justify_text_checkbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justify_text_checkbox.onchange = justify_text_checkbox_on_change;

  const body_line_height_input = document.getElementById('body-line-height');
  body_line_height_input.oninput = body_height_input_on_input;
  const body_line_height_number = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  if(!isNaN(body_line_height_number))
    body_line_height_input.value = (body_line_height_number / 10).toFixed(2);

  const manifest = chrome.runtime.getManifest();
  const ext_name_element = document.getElementById('extension-name');
  ext_name_element.textContent = manifest.name;
  const ext_version_element = document.getElementById('extension-version');
  ext_version_element.textValue = manifest.version;
  const ext_author_element = document.getElementById('extension-author');
  ext_author_element.textContent = manifest.author;
  const ext_description_element = document.getElementById(
    'extension-description');
  ext_description_element.textContent = manifest.description || '';
  const ext_url_element = document.getElementById('extension-homepage');
  ext_url_element.textContent = manifest.homepage_url;

  const subs_list_section = document.getElementById('subs-list-section');
  show_section(subs_list_section);
}, {'once': true});

// TODO: deprecate?
function hide_element(element) {
  element.style.display = 'none';
}

// TODO: deprecate?
function show_element(element) {
  element.style.display = 'block';
}

// TODO: deprecate?
function add_element_class(element, className) {
  element.classList.add(className);
}

// TODO: deprecate?
function remove_element_class(element, className) {
  element.classList.remove(className);
}

// TODO: deprecate?
function is_visible_element(element) {
  return element.style.display !== 'none';
}

}(this));
