'use strict';

// import base/status.js
// import extension.js
// import reader-db.js
// import entry-css.js

// Navigation tracking
var options_page_current_menu_item;
var options_page_current_section_element;

const options_page_settings_channel = new BroadcastChannel('settings');
options_page_settings_channel.onmessage = function(event) {
  console.debug('received settings channel message:', event);
  if(event.data === 'changed') {
    entry_css_on_change(event);
  }
};

options_page_settings_channel.onmessageerror = function(event) {
  console.error(event);
};


function options_page_show_section(menu_item_element) {
  console.assert(menu_item_element);

  if(options_page_current_menu_item === menu_item_element) {
    return;
  }

  if(options_page_current_menu_item) {
    options_page_current_menu_item.classList.remove('navigation-item-selected');
  }

  if(options_page_current_section_element) {
    options_page_current_section_element.style.display = 'none';
  }

  menu_item_element.classList.add('navigation-item-selected');

  // Show the new section
  const section_id = menu_item_element.getAttribute('section');
  const section_element = document.getElementById(section_id);
  console.assert(section_element, 'No matching section ' + section_id);

  section_element.style.display = 'block';

  // Update the global tracking vars
  options_page_current_menu_item = menu_item_element;
  options_page_current_section_element = section_element;
}

function options_page_show_section_id(id) {
  options_page_show_section(document.getElementById(id));
}

function options_page_update_feed_count() {
  const feed_list_element = document.getElementById('feedlist');
  const count = feed_list_element.childElementCount;
  const feed_count_element = document.getElementById('subscription-count');
  if(count > 50) {
    feed_count_element.textContent = ' (50+)';
  } else {
    feed_count_element.textContent = ` (${count})`;
  }
}

function options_page_feed_list_append_feed(feed) {
  const item_element = document.createElement('li');
  item_element.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item_element.setAttribute('feed', feed.id);
  if(feed.description) {
    item_element.setAttribute('title', feed.description);
  }

  item_element.onclick = options_page_feed_list_item_onclick;

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.src = feed.faviconURLString;
    if(feed.title) {
      favicon_element.title = feed.title;
    }

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

  // Insert the feed element into the proper position in the list
  let inserted = false;
  for(const child_node of feed_list_element.childNodes) {
    const key_string =
      (child_node.getAttribute('sort-key') || '').toLowerCase();
    if(indexedDB.cmp(normal_title, key_string) < 1) {
      feed_list_element.insertBefore(item_element, child_node);
      inserted = true;
      break;
    }
  }

  if(!inserted) {
    feed_list_element.appendChild(item_element);
    inserted = true;
  }

  console.assert(inserted);
  options_page_update_feed_count();
}

// @param url {URL}
async function options_page_start_subscription(url) {
  console.log('starting subscription to', url.href);

  options_page_subscription_monitor_show();
  options_page_subscription_monitor_append_message(
    `Subscribing to ${url.href}`);

  const feed = feed_create();
  feed_append_url(feed, url.href);

  let status, subscribed_feed;

  const subscription = new Subscription();
  subscription.feed = feed;
  subscription.reader_conn = reader_conn;
  subscription.icon_conn = icon_conn;

  try {
    [subscription.reader_conn, subscription.icon_conn] = await
      Promise.all([reader_db_open(), favicon_db_open()]);

    const sub_result = await subscription_add(subscription);
    status = sub_result.status;
    subscribed_feed = sub_result.feed;
  } catch(error) {
    console.warn(error);
    options_page_subscription_monitor_hide();
    // TODO: show a visual error message.
    return;
  } finally {
    if(subscription.reader_conn) {
      subscription.reader_conn.close();
    }

    if(subscription.icon_conn) {
      subscription.icon_conn.close();
    }
  }

  // TODO: show an error message.
  if(status !== STATUS_OK) {
    options_page_subscription_monitor_hide();
    return;
  }

  console.assert(subscribed_feed);
  options_page_feed_list_append_feed(subscribed_feed);
  const feed_url = feed_get_top_url(subscribed_feed);
  options_page_subscription_monitor_append_message(`Subscribed to ${feed_url}`);
  options_page_subscription_monitor_hide();
  options_page_show_section_id('subs-list-section');
}

async function options_page_feed_list_item_onclick(event) {
  // Use current target to capture the element with the feed attribute
  const feed_list_item_element = event.currentTarget;
  const feed_id_string = feed_list_item_element.getAttribute('feed');
  const feed_id_number = parseInt(feed_id_string, 10);

  console.assert(!isNaN(feed_id_number));

  // Load feed details from the database
  let conn, feed;
  try {
    conn = await reader_db_open();
    feed = await reader_db_find_feed_by_id(conn, feed_id_number);
  } catch(error) {
    console.warn(error);
    // TODO: visual feedback?
    return;
  } finally {
    if(conn) {
      conn.close();
    }
  }

  const title_element = document.getElementById('details-title');
  title_element.textContent = feed.title || feed.link || 'Untitled';

  const favicon_element = document.getElementById('details-favicon');
  if(feed.faviconURLString) {
    favicon_element.setAttribute('src', feed.faviconURLString);
  } else {
    favicon_element.removeAttribute('src');
  }

  const description_element = document.getElementById(
    'details-feed-description');
  if(feed.description) {
    description_element.textContent = feed.description;
  } else {
    description_element.textContent = '';
  }

  const feed_url_element = document.getElementById('details-feed-url');
  feed_url_element.textContent = feed_get_top_url(feed);
  const feed_link_element = document.getElementById('details-feed-link');
  feed_link_element.textContent = feed.link || '';
  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.value = '' + feed.id;

  // TODO: show num entries, num unread/red, etc
  // TODO: show dateLastModified, datePublished, dateCreated, dateUpdated

  options_page_show_section_id('mi-feed-details');

  // Ensure the details are visible
  window.scrollTo(0,0);
}


// TODO: this function is too large
// TODO: favicon resolution is too slow. Display the results immediately
// using a placeholder. Then, in a separate non-blocking
// task, try and replace the default icon with the proper icon.
// TODO: Suppress resubmits if last query was a search and the
// query did not change
async function options_page_subscribe_form_on_submit(event) {

  // Prevent normal form submission behavior
  event.preventDefault();

  const query_element = document.getElementById('subscribe-discover-query');
  let query_string = query_element.value;
  query_string = query_string || '';
  query_string = query_string.trim();

  if(!query_string) {
    return false;
  }

  const no_results_element = document.getElementById('discover-no-results');

  const progress_element = document.getElementById('discover-in-progress');
  if(progress_element.style.display !== 'none') {
    return false;
  }

  const monitor_element = document.getElementById('submon');
  if(monitor_element && monitor_element.style.display !== 'none') {
    console.debug('canceling submit, subscription in progress');
    return false;
  }

  // Clear the previous results list
  const results_list_element = document.getElementById('discover-results-list');
  results_list_element.innerHTML  = '';


  let url_object = null;
  try {
    url_object = new URL(query_string);
  } catch(exception) {
  }

  // If it is a URL, subscribe
  if(url_object) {
    console.debug('form submit detected url input, not doing search');
    query_element.value = '';

    options_page_start_subscription(url_object);
    return false;
  }

  // TODO: if i am going to deprecate search, then everything below here
  // can be deleted.

  // Search for feeds
  progress_element.style.display = 'block';

  let icon_url, link_url, entries, query;
  const search_timeout_ms = 5000;

  try {
    ({query, entries} =
      await google_feeds_api_search(query_string, search_timeout_ms));
  } catch(error) {
    console.debug(error);
    return false;
  } finally {
    progress_element.style.display = 'none';
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
    if(distinct_urls.includes(entry_object.url.href)) {
      return false;
    }
    distinct_urls.push(entry_object.url.href);
    return true;
  });

  // If, after filtering, there are no more entries, exit early
  if(!entries.length) {
    results_list_element.style.display = 'none';
    no_results_element.style.display = 'block';
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
      snippet = html_truncate(snippet, entry_snippet_max_length,
        replacement_string);
      entry_object.contentSnippet = snippet;
    }
  });

  results_list_element.style.display = 'block';
  no_results_element.style.display = 'none';

  const item_element = document.createElement('li');
  item_element.textContent = `Found ${entries.length} feeds.`;
  results_list_element.appendChild(item_element);

  // TODO: use try/catch
  // TODO: explicit defaults
  let icon_conn;

  icon_conn = await favicon_db_open();
  for(let result of entries) {
    if(!result.link) {
      continue;
    }

    link_url = new URL(result.link);
    // TODO: properly call with all parameteres
    icon_url = await favicon_lookup(icon_conn, link_url);
    result.faviconURLString = icon_url;
  }
  icon_conn.close();

  // TODO: use explicit loops
  const elements = entries.map(options_page_create_search_result_element);
  elements.forEach((el) => results_list_element.appendChild(el));
  return false;// Signal no submit
}



// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
function options_page_create_search_result_element(feed) {
  const item_element = document.createElement('li');
  const subscribe_button = document.createElement('button');
  subscribe_button.value = feed.url.href;
  subscribe_button.title = feed.url.href;
  subscribe_button.textContent = 'Subscribe';
  subscribe_button.onclick = options_page_subscribe_button_on_click;
  item_element.appendChild(subscribe_button);

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', feed.faviconURLString);
    if(feed.link) {
      favicon_element.setAttribute('title', feed.link);
    }

    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item_element.appendChild(favicon_element);
  }

  // TODO: don't allow for empty href value
  const title_element = document.createElement('a');
  if(feed.link) {
    title_element.setAttribute('href', feed.link);
  }

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

function options_page_subscribe_button_on_click(event) {
  const subscribe_button = event.target;
  const url = subscribe_button.value;
  console.assert(url);

  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  const subscription_monitor = document.getElementById('submon');
  if(subscription_monitor && subscription_monitor.style.display !== 'none') {
    return;
  }

  options_page_start_subscription(new URL(url));
}

async function options_page_feed_list_init() {
  const no_feeds_element = document.getElementById('nosubs');
  const feed_list_element = document.getElementById('feedlist');
  let conn, feeds;
  try {
    conn = await reader_db_open();
    feeds = await reader_db_get_feeds(conn);
  } catch(error) {
    // TODO: react to error
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(!feeds) {
    // TODO: react to error
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
    options_page_feed_list_append_feed(feed);
  }

  if(!feeds.length) {
    no_feeds_element.style.display = 'block';
    feed_list_element.style.display = 'none';
  } else {
    no_feeds_element.style.display = 'none';
    feed_list_element.style.display = 'block';
  }
}

// @param feed_id {Number}
function options_page_feed_list_remove_feed(feed_id) {
  const feed_element = document.querySelector(
    `#feedlist li[feed="${feed_id}"]`);

  console.assert(feed_element);

  feed_element.removeEventListener('click',
    options_page_feed_list_item_onclick);
  feed_element.remove();

  // Upon removing the feed, update the displayed number of feeds.
  options_page_update_feed_count();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feed_list_element = document.getElementById('feedlist');
  if(!feed_list_element.childElementCount) {
    feed_list_element.style.display = 'none';

    const no_feeds_element = document.getElementById('nosubs');
    no_feeds_element.style.display = 'block';
  }
}

async function options_page_unsubscribe_button_on_click(event) {

  const subscription = new Subscription();
  subscription.feed = {};

  const radix = 10;
  subscription.feed.id = parseInt(event.target.value, radix);
  console.assert(feed_is_valid_feed_id(subscription.feed.id));

  // TODO: there is no ambiguity here, rename reader_conn to conn
  let reader_conn;
  try {
    subscription.reader_conn = await reader_db_open();

    // TODO: check status of result
    await subscription_remove(subscription);
  } catch(error) {

    // TODO: visually react to unsubscribe error
    console.log(error);
    return;
  } finally {
    if(reader_conn) {
      reader_conn.close();
    }
  }

  options_page_feed_list_remove_feed(subscription.feed.id);
  options_page_show_section_id('subs-list-section');
}

function options_page_import_opml_button_on_click(event) {
  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'application/xml');
  uploader_input.addEventListener('change',
    options_page_import_opml_uploader_on_change);
  uploader_input.click();
}

async function options_page_import_opml_uploader_on_change(event) {
  // TODO: show operation started

  const uploader_input = event.target;

  try {
    await reader_import_files(uploader_input.files);
  } catch(error) {
    // TODO: visual feedback in event an error
    console.warn(error);
    return;
  }

  // TODO: show operation completed successfully
  // TODO: refresh feed list
}

async function options_page_export_opml_button_onclick(event) {
  const status = await options_page_export_opml();
  if(status !== STATUS_OK) {
    console.warn('export failed with status', status);
    // TODO: react to error
  }
}

function options_page_menu_item_on_click(event) {
  const clicked_element = event.target;
  const section_element = event.currentTarget;
  options_page_show_section(section_element);
}

function options_page_enable_notifications_checkbox_on_click(event) {
  if(event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}

function options_page_enable_bg_processing_checkbox_on_click(event) {
  if(event.target.checked) {
    permissions_request('background');
  } else {
    permissions_remove('background');
  }
}

async function init_bg_processing_checkbox() {
  const checkbox = document.getElementById('enable-background');
  console.assert(checkbox);

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.

  checkbox.onclick = options_page_enable_bg_processing_checkbox_on_click;
  checkbox.checked = await permissions_contains('background');
}

function restrict_idle_polling_checkbox_on_click(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

function options_page_background_img_menu_on_change(event) {
  const path = event.target.value;
  if(path) {
    localStorage.BG_IMAGE = path;
  } else {
    delete localStorage.BG_IMAGE;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_header_font_menu_on_change(event){
  const font = event.target.value;
  if(font) {
    localStorage.HEADER_FONT_FAMILY = font;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_body_font_menu_on_change(event) {
  const font = event.target.value;
  if(font) {
    localStorage.BODY_FONT_FAMILY = font;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_column_count_menu_on_change(event) {
  const count = event.target.value;
  if(count) {
    localStorage.COLUMN_COUNT = count;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_entry_bg_color_input_on_input(event) {
  const color = event.target.value;
  if(color) {
    localStorage.BG_COLOR = color;
  } else {
    delete localStorage.BG_COLOR;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_entry_margin_slider_on_change(event) {
  const margin = event.target.value;
  console.log('options_page_entry_margin_slider_on_change new value', margin);

  if(margin) {
    localStorage.PADDING = margin;
  } else {
    delete localStorage.PADDING;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_header_font_size_slider_on_change(event) {
  const size = event.target.value;
  if(size) {
    localStorage.HEADER_FONT_SIZE = size;
  } else {
    delete localStorage.HEADER_FONT_SIZE;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_body_font_size_slider_on_change(event) {
  const size = event.target.value;
  if(size) {
    localStorage.BODY_FONT_SIZE = size;
  } else {
    delete localStorage.BODY_FONT_SIZE;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_justify_text_checkbox_on_change(event) {
  if(event.target.checked) {
    localStorage.JUSTIFY_TEXT = '1';
  } else {
    delete localStorage.JUSTIFY_TEXT;
  }

  options_page_settings_channel.postMessage('changed');
}

function options_page_body_height_input_on_input(event) {
  const height = event.target.value;
  if(height) {
    localStorage.BODY_LINE_HEIGHT = height;
  } else {
    delete localStorage.BODY_LINE_HEIGHT;
  }

  options_page_settings_channel.postMessage('changed');
}

document.addEventListener('DOMContentLoaded', function(event) {
  entry_css_init();

  // Attach click handlers to menu items
  // TODO: use single event listener on list itself instead
  const menu_items = document.querySelectorAll('#navigation-menu li');
  for(const menu_item of menu_items) {
    menu_item.onclick = options_page_menu_item_on_click;
  }

  // Init Enable notifications checkbox
  const enable_notifications_checkbox = document.getElementById(
    'enable-notifications');
  enable_notifications_checkbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  enable_notifications_checkbox.onclick =
    options_page_enable_notifications_checkbox_on_click;

  init_bg_processing_checkbox();

  const enable_restrict_idle_polling_checkbox = document.getElementById(
    'enable-idle-check');
  enable_restrict_idle_polling_checkbox.checked =
    'ONLY_POLL_IF_IDLE' in localStorage;
  enable_restrict_idle_polling_checkbox.onclick =
    restrict_idle_polling_checkbox_on_click;

  const export_opml_button = document.getElementById('button-export-opml');
  export_opml_button.onclick = options_page_export_opml_button_onclick;
  const import_opml_button = document.getElementById('button-import-opml');
  import_opml_button.onclick = options_page_import_opml_button_on_click;

  options_page_feed_list_init();

  // Init feed details section unsubscribe button click handler
  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.onclick = options_page_unsubscribe_button_on_click;

  // Init the subscription form section
  const subscription_form = document.getElementById('subscription-form');
  subscription_form.onsubmit = options_page_subscribe_form_on_submit;


  // Init background image menu
  {
    const background_image_menu = document.getElementById(
      'entry-background-image');
    background_image_menu.onchange = options_page_background_img_menu_on_change;
    let option = document.createElement('option');
    option.value = '';
    option.textContent = 'Use background color';
    background_image_menu.appendChild(option);

    const current_bg_img_path = localStorage.BG_IMAGE;
    const bg_img_path_offset = '/images/'.length;
    for(const path of OPTIONS_PAGE_IMAGE_PATHS) {
      option = document.createElement('option');
      option.value = path;
      option.textContent = path.substring(bg_img_path_offset);
      option.selected = current_bg_img_path === path;
      background_image_menu.appendChild(option);
    }
  }

  {
    const header_font_menu = document.getElementById('select_header_font');
    header_font_menu.onchange = options_page_header_font_menu_on_change;
    let option = document.createElement('option');
    option.textContent = 'Use Chrome font settings';
    header_font_menu.appendChild(option);
    const current_header_font = localStorage.HEADER_FONT_FAMILY;
    for(const font of OPTIONS_PAGE_FONTS) {
      let option = document.createElement('option');
      option.value = font;
      option.selected = font === current_header_font;
      option.textContent = font;
      header_font_menu.appendChild(option);
    }
  }

  {
    const body_font_menu = document.getElementById('select_body_font');
    body_font_menu.onchange = options_page_body_font_menu_on_change;
    let option = document.createElement('option');
    option.textContent = 'Use Chrome font settings';
    body_font_menu.appendChild(option);

    const current_body_font = localStorage.BODY_FONT_FAMILY;
    for(const body_font of OPTIONS_PAGE_FONTS) {
      option = document.createElement('option');
      option.value = body_font;
      option.selected = body_font === current_body_font;
      option.textContent = body_font;
      body_font_menu.appendChild(option);
    }
  }

  {
    const column_count_element = document.getElementById('column-count');
    column_count_element.onchange = options_page_column_count_menu_on_change;
    const column_counts = ['1', '2', '3'];
    const current_column_count = localStorage.COLUMN_COUNT
    for(const column_count of column_counts) {
      const option = document.createElement('option');
      option.value = column_count;
      option.selected = column_count === current_column_count;
      option.textContent = column_count;
      column_count_element.appendChild(option);
    }
  }

  const bg_color_input = document.getElementById('entry-background-color');
  bg_color_input.value = localStorage.BG_COLOR || '';
  bg_color_input.oninput = options_page_entry_bg_color_input_on_input;

  const margin_input = document.getElementById('entry-margin');
  margin_input.value = localStorage.PADDING || '10';
  margin_input.onchange = options_page_entry_margin_slider_on_change;

  const header_font_size_input = document.getElementById('header-font-size');
  header_font_size_input.value = localStorage.HEADER_FONT_SIZE || '1';
  header_font_size_input.onchange =
    options_page_header_font_size_slider_on_change;

  const body_font_size_input = document.getElementById('body-font-size');
  body_font_size_input.value = localStorage.BODY_FONT_SIZE || '1';
  body_font_size_input.onchange = options_page_body_font_size_slider_on_change;

  const justify_text_checkbox = document.getElementById('justify-text');
  justify_text_checkbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justify_text_checkbox.onchange = options_page_justify_text_checkbox_on_change;

  const body_line_height_input = document.getElementById('body-line-height');
  body_line_height_input.oninput = options_page_body_height_input_on_input;
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

  options_page_show_section_id('subs-list-section');
}, {'once': true});
