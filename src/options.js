// See license.md

'use strict';

// TODO: remove subscription preview
// TODO: lookup favicons after displaying search results, not before

{

const settings_chan = new BroadcastChannel('settings');
let current_menu_item = null;
let current_section = null;

function hide_element(element) {
  element.style.display = 'none';
}

function show_element(element) {
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

function show_err_msg(msg, should_fade_in) {
  hide_err_msg();

  const error_element = document.createElement('div');
  error_element.setAttribute('id','options_error_message');

  const msg_element = document.createElement('span');
  msg_element.textContent = msg;
  error_element.appendChild(msg_element);

  const dismiss_btn = document.createElement('button');
  dismiss_btn.setAttribute('id', 'options_dismiss_error_button');
  dismiss_btn.textContent = 'Dismiss';
  dismiss_btn.onclick = hide_err_msg;
  error_element.appendChild(dismiss_btn);

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

// TODO: maybe make an OptionsPageErrorMessage class and have this be
// a member function.
function hide_err_msg() {
  const err_msg = document.getElementById('options_error_message');
  if(err_msg) {
    const dismiss_btn = document.getElementById('options_dismiss_error_button');
    if(dismiss_btn)
      dismiss_btn.removeEventListener('click', hide_err_msg);
    err_msg.remove();
  }
}

// TODO: instead of removing and re-adding, reset and reuse
// TODO: maybe make an OptionsSubscriptionMonitor class and have this just be
// a member function. Call it a widget.
function show_sub_monitor() {

  let monitor = document.getElementById('submon');
  if(monitor)
    monitor.remove();

  monitor = document.createElement('div');
  monitor.setAttribute('id', 'submon');
  monitor.style.opacity = '1';
  document.body.appendChild(monitor);
  const progress = document.createElement('progress');
  progress.textContent = 'Working...';
  monitor.appendChild(progress);
}

function append_sub_monitor_msg(msg) {
  const monitor = document.getElementById('submon');
  if(!monitor)
    throw new Error();
  const msg_element = document.createElement('p');
  msg_element.textContent = msg;
  monitor.appendChild(msg_element);
}

function show_section(menu_item) {
  if(!menu_item)
    throw new TypeError();
  // Do nothing if not switching.
  if(current_menu_item === menu_item)
    return;
  // Make the previous item appear de-selected
  if(current_menu_item)
    remove_class(current_menu_item, 'navigation-item-selected');
  // Hide the old section
  if(current_section)
    hide_element(current_section);
  // Make the new item appear selected
  add_class(menu_item, 'navigation-item-selected');
  // Show the new section
  const section_id = menu_item.getAttribute('section');
  const section_element = document.getElementById(section_id);
  if(section_element)
    show_element(section_element);
  // Update the global tracking vars
  current_menu_item = menu_item;
  current_section = section_element;
}

// TODO: also return the count so that caller does not need to potentially
// do it again. Or, require count to be passed in and change this to just
// options_set_feed_count (and create options_get_feed_count)
// Then, also consider if options_get_feed_count should be using the UI as
// its source of truth or should instead be using the database.
function update_feed_count() {
  const feed_list = document.getElementById('feedlist');
  const feed_count_element = document.getElementById('subscription-count');
  const count = feed_list.childElementCount;
  // TODO: use ternary
  if(count > 1000)
    feed_count_element.textContent = ' (999+)';
  else
    feed_count_element.textContent = ` (${count})`;
}

// TODO: this approach doesn't really work, I need to independently sort
// on load because it should be case-insensitive.
// TODO: rename, where is this appending, and to what? Maybe this should be a
// member function of some type of feed menu object
// TODO: this should always use inserted sort, that should be invariant, and
// so I shouldn't accept a parameter
function append_feed(feed, should_insert_in_order) {
  const item = document.createElement('li');
  item.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  item.setAttribute('feed', feed.id);
  if(feed.description)
    item.setAttribute('title', feed.description);
  item.onclick = feed_list_item_on_click;

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.src = feed.faviconURLString;
    if(feed.title)
      favicon_element.title = feed.title;
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  let feedTitleStr = feed.title || 'Untitled';
  feedTitleStr = truncate_html(feedTitleStr, 300);
  title_element.textContent = feedTitleStr;
  item.appendChild(title_element);
  const feed_list = document.getElementById('feedlist');
  const lc_title_str = feedTitleStr.toLowerCase();

  // Insert the feed item element into the proper position in the list
  if(should_insert_in_order) {
    let added = false;
    for(let child of feed_list.childNodes) {
      const key = (child.getAttribute('sort-key') || '').toLowerCase();
      if(indexedDB.cmp(lc_title_str, key) < 0) {
        feed_list.insertBefore(item, child);
        added = true;
        break;
      }
    }

    if(!added)
      feed_list.appendChild(item);
  } else {
    feed_list.appendChild(item);
  }
}

// TODO: deprecate the ability to preview
async function show_sub_preview(url) {
  if(!is_url_object(url))
    throw new TypeError();
  hide_sub_preview();
  if(!('ENABLE_SUBSCRIBE_PREVIEW' in localStorage)) {
    start_subscription(url);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    start_subscription(url);
    return;
  }

  const preview_element = document.getElementById('subscription-preview');
  show_element(preview_element);
  const progress_element = document.getElementById(
    'sub-preview-load-progress');
  show_element(progress_element);

  try {
    let fetch_output = fetch_feed(url, console);
    const progress_element = document.getElementById(
      'sub-preview-load-progress');
    hide_element(progress_element);

    const feed = fetch_output.feed;
    const title_element = document.getElementById('subscription-preview-title');
    // TODO: what about HTML in title
    title_element.textContent = feed.title || 'Untitled';

    // Fetch feed generates an array of URL objects. Use the last one in the
    // list as the button's value.
    const continue_btn = document.getElementById(
      'subscription-preview-continue');
    continue_btn.value = get_feed_url(feed);

    const results_list_element = document.getElementById(
      'subscription-preview-entries');

    if(!fetch_output.entries.length) {
      let item = document.createElement('li');
      item.textContent = 'No previewable entries';
      results_list_element.appendChild(item);
    }

    // TODO: use for..of. Because I want to limit, I need to
    // slice or take or whatever
    // TODO: if tags are replaced by search_google_feeds then I don't need
    // to do it here
    const limit = Math.min(5, fetch_output.entries.length);
    for(let i = 0; i < limit; i++) {
      const entry = fetch_output.entries[i];
      const item = document.createElement('li');
      item.innerHTML = replace_tags(entry.title || '', '');
      const content = document.createElement('span');
      content.innerHTML = entry.content || '';
      item.appendChild(content);
      results_list_element.appendChild(item);
    }
  } catch(error) {
    console.log(error);
    hide_sub_preview();
    show_err_msg('Unable to fetch ' + url.href);
  }
}

function hide_sub_preview() {
  const preview_element = document.getElementById('subscription-preview');
  hide_element(preview_element);
  const results_list_element = document.getElementById(
    'subscription-preview-entries');
  while(results_list_element.firstChild) {
    results_list_element.firstChild.remove();
  }
}

// TODO: if subscribing from a discover search result, I already know some
// of the feed's other properties, such as its title and link. I should be
// passing those along to start_subscription and setting them here. Or
// start_subscription should expect a feed object as a parameter.
async function start_subscription(url) {
  if(!is_url_object(url))
    throw new TypeError();
  hide_sub_preview();
  show_sub_monitor();
  append_sub_monitor_msg(`Subscribing to ${url.href}`);
  const feed = {};
  add_feed_url(feed, url.href);
  const feed_db_conn = null;
  const suppress_notifs = false;
  const icon_cache_conn = null;
  let fade_out = false;
  try {
    let subbed_feed = await subscribe(feed_db_conn, icon_cache_conn, feed,
      suppress_notifs, console);
    append_feed(subbed_feed, true);
    update_feed_count();
    const feed_url = get_feed_url(subbed_feed);
    append_sub_monitor_msg(`Subscribed to ${feed_url}`);

    const monitor = document.getElementById('submon');
    await fade_element(monitor, 2, 1);
    monitor.remove();

    const subs_section = document.getElementById('subs-list-section');
    show_section(subs_section);
  } catch(error) {
    console.debug(error);
  }
}

// TODO: show num entries, num unread/red, etc
// TODO: show dateLastModified, datePublished, dateCreated, dateUpdated
// TODO: react to errors
async function feed_list_item_on_click(event) {
  const feed_id = parseInt(event.currentTarget.getAttribute('feed'), 10);
  if(!Number.isInteger(feed_id) || feed_id < 1)
    throw new TypeError();

  // TODO: should this even catch?
  let conn, feed;
  try {
    conn = await db_connect(undefined, undefined, console);
    feed = await db_find_feed_by_id(conn, feed_id, console);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }

  // TODO: should this throw?
  if(!feed) {
    console.error('No feed found with id', feed_id);
    return;
  }

  const title_element = document.getElementById('details-title');
  title_element.textContent = feed.title || 'Untitled';
  const favicon_element = document.getElementById('details-favicon');
  if(feed.faviconURLString)
    favicon_element.setAttribute('src', feed.faviconURLString);
  else
    favicon_element.removeAttribute('src');
  const desc_element = document.getElementById('details-feed-description');
  if(feed.description)
    desc_element.textContent = feed.description;
  else
    desc_element.textContent = '';

  const feed_url_element = document.getElementById('details-feed-url');
  feed_url_element.textContent = get_feed_url(feed);
  const feed_link_element = document.getElementById('details-feed-link');
  feed_link_element.textContent = feed.link || '';
  const unsub_btn = document.getElementById('details-unsubscribe');
  unsub_btn.value = '' + feed.id;

  const details_element = document.getElementById('mi-feed-details');
  show_section(details_element);
  window.scrollTo(0,0);// long list may obscure details otherwise
}

// TODO: favicon resolution is too slow. Display the results immediately
// using a placeholder. Then, in a separate non-blocking
// task, try and replace the default icon with the proper icon.
// TODO: Suppress resubmits if last query was a search and the
// query did not change?
async function sub_form_on_submit(event) {
  // Prevent normal form submission behavior
  event.preventDefault();

  const query_element = document.getElementById('subscribe-discover-query');
  let query_str = query_element.value;
  query_str = query_str || '';
  query_str = query_str.trim();

  if(!query_str)
    return false;

  // Do nothing if searching in progress
  const progress_element = document.getElementById('discover-in-progress');
  if(is_visible(progress_element))
    return false;

  // Do nothing if subscription in progress
  const monitor = document.getElementById('submon');
  if(monitor && is_visible(monitor))
    return false;

  // Clear the previous results list
  const results_list_element = document.getElementById('discover-results-list');
  while(results_list_element.firstChild) {
    results_list_element.firstChild.remove();
  }

  // Ensure the no-results-found message, if present from a prior search,
  // is hidden. This should never happen because we exit early if it is still
  // visible above.
  hide_element(progress_element);

  let url = null;
  try {
    url = new URL(query_str);
  } catch(exception) {
  }



  // If it is a URL, subscribe
  if(url) {
    query_element.value = '';
    show_sub_preview(url);
    return false;
  }

  // Search for feeds
  show_element(progress_element);

  let icon_url, link_url, results;

  try {
    let sgf_output = await search_google_feeds(query_str);
    const query = sgf_output.query;
    results = sgf_output.entries;
    const progress_element = document.getElementById('discover-in-progress');
    const no_results_element = document.getElementById('discover-no-results');
    const results_element = document.getElementById('discover-results-list');

    hide_element(progress_element);
    if(!results.length) {
      hide_element(results_element);
      show_element(no_results_element);
      return;
    }

    if(is_visible(results_element)) {
      results_element.innerHTML = '';
    } else {
      hide_element(no_results_element);
      show_element(results_element);
    }

    const item_element = document.createElement('li');
    item_element.textContent = `Found ${results.length} feeds.`;
    results_element.appendChild(item_element);

    const conn = await favicon_connect(undefined, undefined, console);
    for(let result of results) {
      if(!result.link)
        continue;
      link_url = new URL(result.link);
      icon_url = await favicon_lookup(conn, link_url, console);
      if(icon_url)
        result.faviconURLString = icon_url.href;
    }
    conn.close();
  } catch(error) {
    console.debug(error);
  }

  const result_elements = results.map(create_search_result_element);
  for(let i = 0, len = result_elements.length; i < len; i++) {
    results_element.appendChild(result_elements[i]);
  }

  // Signal no submit
  return false;
}

// Creates and returns a search result item to show in the list of search
// results when searching for feeds.
function create_search_result_element(feed) {
  const item = document.createElement('li');
  const subscribe_btn = document.createElement('button');
  subscribe_btn.value = feed.url.href;
  subscribe_btn.title = feed.url.href;
  subscribe_btn.textContent = 'Subscribe';
  subscribe_btn.onclick = subscribe_btn_on_click;
  item.appendChild(subscribe_btn);

  if(feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', feed.faviconURLString);
    if(feed.link) {
      favicon_element.setAttribute('title', feed.link);
    }
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item.appendChild(favicon_element);
  }

  // TODO: don't allow for empty href value
  const title_element = document.createElement('a');
  if(feed.link) {
    title_element.setAttribute('href', feed.link);
  }
  title_element.setAttribute('target', '_blank');
  title_element.title = feed.title;
  title_element.innerHTML = feed.title;
  item.appendChild(title_element);

  const snippet_element = document.createElement('span');
  snippet_element.innerHTML = feed.contentSnippet;
  item.appendChild(snippet_element);

  const url_element = document.createElement('span');
  url_element.setAttribute('class', 'discover-search-result-url');
  url_element.textContent = feed.url.href;
  item.appendChild(url_element);
  return item;
}


function subscribe_btn_on_click(event) {
  const button = event.target;
  const feed_url_str = button.value;

  // TODO: this will always be defined, so this check isn't necessary, but I
  // tentatively leaving it in here
  if(!feed_url_str)
    return;
  // TODO: Ignore future clicks if an error was displayed?

  // Ignore future clicks while subscription in progress
  // TODO: use a better element name here.
  const monitor = document.getElementById('submon');
  if(monitor && is_visible(monitor))
    return;
  // Show subscription preview expects a URL object, so convert. This can
  // throw but never should so I do not use try/catch.
  const feed_url = new URL(feed_url_str);
  // TODO: I plan to deprecate the preview step, so this should probably be
  // making a call directly to the step that starts the subscription process.
  show_sub_preview(feed_url);
}

function remove_feed_from_feed_list(feed_id) {
  const feed_element = document.querySelector(
    `#feedlist li[feed="${feed_id}"]`);

  if(!feed_element)
    throw new Error();
  feed_element.removeEventListener('click', feed_list_item_on_click);
  feed_element.remove();
  // Upon removing the feed, update the displayed number of feeds.
  update_feed_count();
  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feed_list = document.getElementById('feedlist');
  const no_feeds_element = document.getElementById('nosubs');
  if(!feed_list.childElementCount) {
    hide_element(feed_list);
    show_element(no_feeds_element);
  }
}

async function unsubscribe_btn_on_click(event) {
  console.debug('Clicked unsubscribe');
  const feed_id = parseInt(event.target.value, 10);
  if(!Number.isInteger(feed_id))
    throw new TypeError();
  try {
    let num_deleted = await unsubscribe(feed_id, console);
    console.debug('Unsubscribed from feed id', feed_id);
    remove_feed_from_feed_list(feed_id);
    const subs_section = document.getElementById('subs-list-section');
    show_section(subs_section);
  } catch(error) {
    // TODO: show an error
    console.debug(error);
  }
}

// TODO: needs to notify the user of a successful
// import. In the UI and maybe in a notification. Maybe also combine
// with the immediate visual feedback (like a simple progress monitor
// popup but no progress bar). The monitor should be hideable. No
// need to be cancelable.
// TODO: after import the feeds list needs to be refreshed
// TODO: notify the user if there was an error
// TODO: switch to a different section of the options ui on complete?

function import_opml_btn_on_click(event) {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.setAttribute('accept', 'application/xml');
  uploader.onchange = async function on_change(event) {
    uploader.removeEventListener('change', on_change);
    try {
      await import_opml(undefined, uploader.files, console);
    } catch(error) {
      console.debug(error);
    }
  };
  uploader.click();
}

// TODO: visual feedback
async function export_opml_btn_on_click(event) {
  console.debug('Clicked export opml button');
  const title = 'Subscriptions';
  const file_name = 'subs.xml';
  let conn, feeds;
  try {
    conn = await db_connect(undefined, undefined, console);
    feeds = await db_get_all_feeds(conn);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }

  if(feeds)
    export_opml(feeds, title, file_name);
}

// TODO: sort feeds alphabetically
// TODO: react to errors
async function init_subs_section() {
  const no_feeds_element = document.getElementById('nosubs');
  const feed_list = document.getElementById('feedlist');
  let conn, feeds;

  try {
    conn = await db_connect(undefined, undefined, console);
    feeds = await db_get_all_feeds(conn);
  } catch(error) {
    console.debug(error);
    return;
  } finally {
    if(conn)
      conn.close();
  }

  for(let feed of feeds) {
    append_feed(feed);
    update_feed_count();
  }

  if(!feeds.length) {
    show_element(no_feeds_element);
    hide_element(feed_list);
  } else {
    hide_element(no_feeds_element);
    show_element(feed_list);
  }
}


// Use currentTarget instead of event.target as some of the menu items have a
// nested element that is the desired target
// TODO: rather than comment, use a local variable here to clarify why
// currentTarget is more appropriate
function nav_item_on_click(event) {
  show_section(event.currentTarget);
}

function enable_notifs_checkbox_on_change(event) {
  if(event.target.checked)
    localStorage.SHOW_NOTIFICATIONS = '1';
  else
    delete localStorage.SHOW_NOTIFICATIONS;
}

function enable_bg_process_checkbox_on_click(event) {
  if(event.target.checked) {
    chrome.permissions.request({'permissions': ['background']}, noop);
  }
  else {
    chrome.permissions.remove({'permissions': ['background']}, noop);
  }
}

function noop() {}

function enable_bg_process_on_check_perm(permitted) {
  const checkbox = document.getElementById('enable-background');
  checkbox.checked = permitted;
}

function restrict_poll_idle_checkbox_on_change(event) {
  if(event.target.checked)
    localStorage.ONLY_POLL_IF_IDLE = '1';
  else
    delete localStorage.ONLY_POLL_IF_IDLE;
}

function enable_preview_checkbox_on_change(event) {
  if(this.checked)
    localStorage.ENABLE_SUBSCRIBE_PREVIEW = '1';
  else
    delete localStorage.ENABLE_SUBSCRIBE_PREVIEW;
}

function preview_continue_btn_on_click(event) {
  const urlString = event.currentTarget.value;
  hide_sub_preview();

  if(!urlString) {
    console.debug('no url');
    return;
  }

  const feed_url = new URL(urlString);
  start_subscription(feed_url);
}

function enable_bg_img_menu_on_change(event) {
  if(event.target.value)
    localStorage.BACKGROUND_IMAGE = event.target.value;
  else
    delete localStorage.BACKGROUND_IMAGE;
  settings_chan.postMessage('changed');
}

function header_font_menu_on_change(event){
  const selected_option = event.target.value;
  if(selected_option)
    localStorage.HEADER_FONT_FAMILY = selected_option;
  else
    delete localStorage.HEADER_FONT_FAMILY;
  settings_chan.postMessage('changed');
}

function body_font_menu_on_change(event) {
  if(event.target.value)
    localStorage.BODY_FONT_FAMILY = event.target.value;
  else
    delete localStorage.BODY_FONT_FAMILY;

  settings_chan.postMessage('changed');
}

function col_count_menu_on_change(event) {
  if(event.target.value)
    localStorage.COLUMN_COUNT = event.target.value;
  else
    delete localStorage.COLUMN_COUNT;
  settings_chan.postMessage('changed');
}

function entry_bg_color_on_input() {
  const element = event.target;
  const value = element.value;
  if(value)
    localStorage.ENTRY_BACKGROUND_COLOR = value;
  else
    delete localStorage.ENTRY_BACKGROUND_COLOR;
  settings_chan.postMessage('changed');
}

function entry_margin_on_change(event) {
  // TODO: why am i defaulting to 10 here?
  localStorage.ENTRY_MARGIN = event.target.value || '10';

  settings_chan.postMessage('changed');
}

function header_font_size_on_change(event) {
  localStorage.HEADER_FONT_SIZE = event.target.value || '1';
  settings_chan.postMessage('changed');
}

function body_font_size_on_change(event) {
  localStorage.BODY_FONT_SIZE = event.target.value || '1';
  settings_chan.postMessage('changed');
}

function justify_checkbox_on_change(event) {
  if(event.target.checked)
    localStorage.JUSTIFY_TEXT = '1';
  else
    delete localStorage.JUSTIFY_TEXT;
  settings_chan.postMessage('changed');
}

function body_height_on_input(event) {
  localStorage.BODY_LINE_HEIGHT = event.target.value || '10';
  settings_chan.postMessage('changed');
}

function on_dom_loaded(event) {

  // Init CSS styles that affect the display preview area
  display_load_styles();

  // Attach click handlers to feeds in the feed list on the left.
  // TODO: it would probably be easier and more efficient to attach a single
  // click handler that figures out which item was clicked.
  const nav_feed_items = document.querySelectorAll('#navigation-menu li');
  for(let item of nav_feed_items) {
    item.onclick = nav_item_on_click;
  }

  // Setup the Enable Notifications checkbox in the General Settings section
  const enable_notifs_checkbox = document.getElementById(
    'enable-notifications');
  enable_notifs_checkbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  enable_notifs_checkbox.onclick = enable_notifs_checkbox_on_change;

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.
  // TODO: should this be onchange or onclick? I had previously named the
  // function onchange but was listening to onclick
  // TODO: use the new, more global, navigator.permission check instead of
  // the extension API ?
  const enable_bg_process_checkbox = document.getElementById(
    'enable-background');
  enable_bg_process_checkbox.onclick = enable_bg_process_checkbox_on_click;
  chrome.permissions.contains({'permissions': ['background']},
    enable_bg_process_on_check_perm);

  const restrict_poll_idle_checkbox = document.getElementById(
    'enable-idle-check');
  restrict_poll_idle_checkbox.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
  restrict_poll_idle_checkbox.onclick = restrict_poll_idle_checkbox_on_change;

  // TODO: deprecate this because I plan to deprecate the preview ability.
  const enable_preview_checkbox =
    document.getElementById('enable-subscription-preview');
  enable_preview_checkbox.checked = 'ENABLE_SUBSCRIBE_PREVIEW' in localStorage;
  enable_preview_checkbox.onchange = enable_preview_checkbox_on_change;

  const export_opml_btn = document.getElementById('button-export-opml');
  export_opml_btn.onclick = export_opml_btn_on_click;
  const import_opml_btn = document.getElementById('button-import-opml');
  import_opml_btn.onclick = import_opml_btn_on_click;

  init_subs_section();

  // Init feed details section unsubscribe button click handler
  const unsub_btn = document.getElementById('details-unsubscribe');
  unsub_btn.onclick = unsubscribe_btn_on_click;

  // Init the subscription form section
  const sub_form = document.getElementById('subscription-form');
  sub_form.onsubmit = sub_form_on_submit;
  const continue_preview_btn = document.getElementById(
    'subscription-preview-continue');
  continue_preview_btn.onclick = preview_continue_btn_on_click;

  // Init display settings

  // Setup the entry background image menu
  const bg_img_menu = document.getElementById('entry-background-image');
  bg_img_menu.onchange = enable_bg_img_menu_on_change;

  // TODO: stop trying to reuse the option variable, create separate variables
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  bg_img_menu.appendChild(option);

  // Load bgimages menu
  const current_bg_image_path = localStorage.BACKGROUND_IMAGE;
  const bg_img_path_offset = '/images/'.length;
  for(let path of config.bg_img_paths) {
    let path_option = document.createElement('option');
    path_option.value = path;
    path_option.textContent = path.substring(bg_img_path_offset);
    path_option.selected = current_bg_image_path === path;
    bg_img_menu.appendChild(path_option);
  }

  // Setup header font menu
  const header_font_menu = document.getElementById('select_header_font');
  header_font_menu.onchange = header_font_menu_on_change;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  header_font_menu.appendChild(option);
  const selected_hf = localStorage.HEADER_FONT_FAMILY;
  for(let ff of config.font_families) {
    let ff_option = document.createElement('option');
    ff_option.value = ff;
    ff_option.selected = ff === selected_hf;
    ff_option.textContent = ff;
    header_font_menu.appendChild(ff_option);
  }

  // Setup the body font menu
  const body_font_menu = document.getElementById('select_body_font');
  body_font_menu.onchange = body_font_menu_on_change;
  option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  body_font_menu.appendChild(option);
  const current_bff = localStorage.BODY_FONT_FAMILY;
  for(let bff of config.font_families) {
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

  col_count_element.onchange = col_count_menu_on_change;

  const bg_color_element = document.getElementById('entry-background-color');
  bg_color_element.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  bg_color_element.oninput = entry_bg_color_on_input;

  const margin_element = document.getElementById('entry-margin');
  margin_element.value = localStorage.ENTRY_MARGIN || '10';
  margin_element.onchange = entry_margin_on_change;

  const header_font_size_element = document.getElementById('header-font-size');
  header_font_size_element.value = localStorage.HEADER_FONT_SIZE || '1';
  header_font_size_element.onchange = header_font_size_on_change;

  const body_font_size_element = document.getElementById('body-font-size');
  body_font_size_element.value = localStorage.BODY_FONT_SIZE || '1';
  body_font_size_element.onchange = body_font_size_on_change;

  const justify_checkbox = document.getElementById('justify-text');
  justify_checkbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justify_checkbox.onchange = justify_checkbox_on_change;

  const body_height_element = document.getElementById('body-line-height');
  const line_height_int = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
  body_height_element.value = (line_height_int / 10).toFixed(2);
  body_height_element.oninput = body_height_on_input;

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

  const subs_section = document.getElementById('subs-list-section');
  show_section(subs_section);
}

document.addEventListener('DOMContentLoaded', on_dom_loaded, {'once': true});

}
