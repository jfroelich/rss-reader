import * as cdb from '/src/core/cdb.js';
import * as favicon from '/src/core/favicon.js';
import * as ops from '/src/core/ops.js';
import {PollOperation} from '/src/core/poll-feeds.js';
import * as platform from '/src/lib/platform.js';
import * as tls from '/src/lib/tls.js';

let current_menu_item;
let current_section;

const channel = new BroadcastChannel('reader');
channel.onmessage = function options_page_onmessage(event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  const type = message.type;

  // We also listen here for now, because we can do things like unsubscribe
  // from here, and that could affect unread count. If unsubscribing from here
  // then slideshow may not be loaded, and also background page may not be
  // loaded.
  const badge_types = ['entry-created', 'entry-updated', 'entry-deleted'];
  if (badge_types.includes(type)) {
    ops.badge_refresh();
  }

  if (type === 'feed-activated') {
    // not implemented
  } else if (type === 'feed-deactivated') {
    // not implemented
  } else if (type === 'feed-updated') {
    // not implemented
  } else if (type === 'feed-created') {
    // TODO: feeds can be added (such as by opml-import) through slideshow or
    // other pages, the feed-list displayed here needs to dynamically update
    // not implemented
  } else if (type === 'entry-created') {
    // not implemented
  } else if (type === 'entry-updated') {
    // not implemented
  } else if (type === 'feed-deleted') {
    // not implemented
  } else if (type === 'entry-deleted') {
    // not implemented
  } else {
    console.warn('Unknown message type', type);
  }
};

channel.onmessageerror = function(event) {
  console.warn(event);
};

// TODO: move to utils or dom-utils
function fade_element(element, duration_secs, delay_secs) {
  return new Promise((resolve, reject) => {
    if (!element) {
      return reject(new Error('Invalid element ' + element));
    }

    if (!element.style) {
      return reject(new Error('Cannot fade element without a style property'));
    }

    duration_secs = isNaN(duration_secs) ? 1 : duration_secs;
    delay_secs = isNaN(delay_secs) ? 0 : delay_secs;

    const style = element.style;
    if (style.display === 'none') {
      // If the element is hidden, it may not have an opacity set. When fading
      // in the element by setting opacity to 1, it has to change from 0 to
      // work.
      style.opacity = '0';

      // If the element is hidden, and its opacity is 0, make it eventually
      // visible
      style.display = 'block';
    } else {
      // If the element is visible, and we plan to hide it by setting its
      // opacity to 0, it has to change from opacity 1 for fade to work
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {once: true});
    style.transition = `opacity ${duration_secs}s ease ${delay_secs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}

function subscription_monitor_show() {
  let monitor_element = document.getElementById('submon');
  if (monitor_element) {
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

function subscription_monitor_append_message(message) {
  const message_element = document.createElement('p');
  message_element.textContent = message;
  const monitor_element = document.getElementById('submon');
  monitor_element.appendChild(message_element);
}

async function subscription_monitor_hide() {
  const monitor_element = document.getElementById('submon');
  if (!monitor_element) {
    console.error('Cannot find element #submon');
    return;
  }

  const duration_secs = 2, delay_secs = 1;
  await fade_element(monitor_element, duration_secs, delay_secs);
  monitor_element.remove();
}

export function error_message_show(message, fade) {
  error_message_hide();

  const error_element = document.createElement('div');
  error_element.setAttribute('id', 'options-error-message');

  const message_element = document.createElement('span');
  message_element.textContent = message;
  error_element.appendChild(message_element);

  const dismiss_button = document.createElement('button');
  dismiss_button.setAttribute('id', 'dismiss-error-button');
  dismiss_button.textContent = 'Dismiss';
  dismiss_button.onclick = error_message_hide;
  error_element.appendChild(dismiss_button);

  if (fade) {
    error_element.style.opacity = '0';
    document.body.appendChild(error_element);
    const duration = 1, delay = 0;
    fade_element(container, duration, delay);
  } else {
    error_element.style.opacity = '1';
    error_element.style.display = 'block';
    document.body.appendChild(error_element);
  }
}

export function error_message_hide() {
  const error_element = document.getElementById('options-error-message');
  if (!error_element) {
    return;
  }

  const dismiss_button = document.getElementById('dismiss-error-button');
  if (dismiss_button) {
    dismiss_button.removeEventListener('click', error_message_hide);
  }
  error_element.remove();
}

function section_show(menu_item_element) {
  if (menu_item_element && menu_item_element !== current_menu_item) {
    if (current_menu_item) {
      current_menu_item.classList.remove('navigation-item-selected');
    }
    if (current_section) {
      current_section.style.display = 'none';
    }
    menu_item_element.classList.add('navigation-item-selected');
    const section_id = menu_item_element.getAttribute('section');
    const section_element = document.getElementById(section_id);
    section_element.style.display = 'block';
    current_menu_item = menu_item_element;
    current_section = section_element;
  }
}

function section_show_by_id(id) {
  section_show(document.getElementById(id));
}

function feed_count_update() {
  const feed_list_element = document.getElementById('feedlist');
  const count = feed_list_element.childElementCount;
  const feed_count_element = document.getElementById('subscription-count');
  feed_count_element.textContent = count > 50 ? ' (50+)' : ` (${count})`;
}

function feed_list_append_feed(feed) {
  const item_element = document.createElement('li');
  item_element.setAttribute('sort-key', feed.title);
  item_element.setAttribute('feed', feed.id);
  if (feed.description) {
    item_element.setAttribute('title', feed.description);
  }

  if (feed.active !== true) {
    item_element.setAttribute('inactive', 'true');
  }

  item_element.onclick = feed_list_item_onclick;

  if (feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.src = feed.faviconURLString;
    if (feed.title) {
      favicon_element.title = feed.title;
    }

    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item_element.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  // TODO: use Feed.getURLString
  let feed_title = feed.title || feed.urls[feed.urls.length - 1];
  // Title is automatically truncated via CSS so just produce the full value
  title_element.textContent = feed_title;
  item_element.appendChild(title_element);
  const feed_list_element = document.getElementById('feedlist');
  const normal_title = feed_title.toLowerCase();

  let inserted = false;
  for (const child_node of feed_list_element.childNodes) {
    let key_string = child_node.getAttribute('sort-key');
    key_string = key_string || '';
    key_string = key_string.toLowerCase();

    if (indexedDB.cmp(normal_title, key_string) < 1) {
      feed_list_element.insertBefore(item_element, child_node);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    feed_list_element.appendChild(item_element);
    inserted = true;
  }
  feed_count_update();
}

// TODO: if this handler is bound to the feed list and not individual items,
// then it would be more appropriate and clear to rename the function to
// feed_list_onclick, and this would in turn provided clarity regarding the
// use of currentTarget instead of target here.
async function feed_list_item_onclick(event) {
  const feed_list_item_element = event.currentTarget;
  const feed_id_string = feed_list_item_element.getAttribute('feed');
  const feed_id = parseInt(feed_id_string, 10);

  const session = new cdb.CDB();
  await session.open();
  const feed = await session.getFeed('id', feed_id, false);
  session.close();

  const title_element = document.getElementById('details-title');
  title_element.textContent =
      feed.title || feed.link || feed.urls[feed.urls.length - 1];

  const favicon_element = document.getElementById('details-favicon');
  if (feed.faviconURLString) {
    favicon_element.setAttribute('src', feed.faviconURLString);
  } else {
    favicon_element.removeAttribute('src');
  }

  const desc_element = document.getElementById('details-feed-description');
  if (feed.description) {
    desc_element.textContent = feed.description;
  } else {
    desc_element.textContent = '';
  }

  const feed_url_element = document.getElementById('details-feed-url');
  if (feed.urls && feed.urls.length) {
    feed_url_element.textContent = feed.urls[feed.urls.length - 1];
  }

  const feed_link_element = document.getElementById('details-feed-link');
  feed_link_element.textContent = feed.link || '';

  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.value = '' + feed.id;

  const activate_button = document.getElementById('details-activate');
  activate_button.value = '' + feed.id;
  activate_button.disabled = feed.active === true ? true : false;

  const deactivate_button = document.getElementById('details-deactivate');
  deactivate_button.value = '' + feed.id;
  deactivate_button.disabled = feed.active === false ? true : false;

  section_show_by_id('mi-feed-details');
  scrollTo(0, 0);
}

async function subscribe_form_onsubmit(event) {
  event.preventDefault();

  let monitor_element = document.getElementById('submon');
  if (monitor_element && monitor_element.style.display === 'block') {
    console.debug('prior subscription in progress');
    return false;
  }

  subscription_monitor_show();

  // TODO: this seems redundant with above???
  monitor_element = document.getElementById('submon');

  const subscribe_url_input_element = document.getElementById('subscribe-url');
  let subscribe_url_string = subscribe_url_input_element.value;
  subscribe_url_string = subscribe_url_string || '';
  subscribe_url_string = subscribe_url_string.trim();

  if (!subscribe_url_string) {
    return false;
  }

  let subscribe_url;
  try {
    subscribe_url = new URL(subscribe_url_string);
  } catch (exception) {
    console.debug(exception);
    return false;
  }

  subscribe_url_input_element.value = '';
  subscription_monitor_show();
  subscription_monitor_append_message(`Subscribing to ${subscribe_url.href}`);

  // TODO: subscribe can now throw an error, this should catch the error and
  // show a nice error message or something instead of panic

  const session = new cdb.CDB();
  const promises = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(promises);
  const feed =
      await ops.subscribe(session, iconn, subscribe_url, undefined, true);
  session.close();
  iconn.close();

  feed_list_append_feed(feed);

  const final_url_string = feed.urls[feed.urls.length - 1];
  subscription_monitor_append_message('Subscribed to ' + final_url_string);

  subscription_monitor_hide();
  section_show_by_id('subs-list-section');

  // intentionally non-blocking
  // NOTE: we must use setTimeout or we can get a 503 error for requesting the
  // feed again too quickly

  setTimeout(function() {
    try {
      after_subscribe_poll_feed_async(feed).catch(console.error);
    } catch (error) {
      console.debug(error);
    }
  }, 5000);

  return false;
}

async function after_subscribe_poll_feed_async(feed) {
  const session = new cdb.CDB();
  const promises = [session.open(), favicon.open()];
  const [_, iconn] = await Promise.all(promises);

  const op = new PollOperation();
  op.session = session;
  op.iconn = iconn;
  op.ignore_recency_check = true;
  op.notify = true;
  await op.pollFeed(feed);
  session.close();
  iconn.close();
}

async function feed_list_init() {
  const session = new cdb.CDB();
  await session.open();
  const feeds = await session.getFeeds('all', true);
  session.close();

  for (const feed of feeds) {
    // TODO: I think this is actually a concern of feed_list_append_feed? I do
    // not think this needs to be done here, but not sure
    // TODO: use more opaque Feed.getURLString call
    feed.title = feed.title || feed.urls[feed.urls.length - 1];
    feed_list_append_feed(feed);
  }

  const no_feeds_element = document.getElementById('nosubs');
  const feed_list_element = document.getElementById('feedlist');
  if (feeds.length) {
    no_feeds_element.style.display = 'none';
    feed_list_element.style.display = 'block';
  } else {
    no_feeds_element.style.display = 'block';
    feed_list_element.style.display = 'none';
  }
}

function feed_list_remove_feed_by_id(feed_id) {
  const feed_element =
      document.querySelector(`#feedlist li[feed="${feed_id}"]`);

  // TODO: throw an error instead of log+return
  if (!feed_element) {
    console.error('Could not find feed element with feed id', feed_id);
    return;
  }

  feed_element.removeEventListener('click', feed_list_item_onclick);
  feed_element.remove();

  feed_count_update();

  const feed_list_element = document.getElementById('feedlist');
  const no_feeds_element = document.getElementById('nosubs');
  if (!feed_list_element.childElementCount) {
    feed_list_element.style.display = 'none';
    no_feeds_element.style.display = 'block';
  }
}

async function unsubscribe_button_onclick(event) {
  const feed_id = parseInt(event.target.value, 10);

  const session = new cdb.CDB();
  await session.open();
  await ops.unsubscribe(session, feed_id);
  session.close();

  feed_list_remove_feed_by_id(feed_id);
  section_show_by_id('subs-list-section');
}

async function activate_feed_button_onclick(event) {
  const feed_id = parseInt(event.target.value, 10);

  const session = new cdb.CDB();
  await session.open();
  await ops.activate_feed(session, feed_id);
  session.close();

  // TODO: handling the event here may be wrong, it should be done in the
  // message handler. However, I am not sure how much longer the options page
  // is sticking around

  // Mark the corresponding feed element displayed in the view as active
  const item_element = document.querySelector('li[feed="' + feed_id + '"]');
  if (item_element) {
    item_element.removeAttribute('inactive');
  }

  section_show_by_id('subs-list-section');
}

async function deactivate_feed_button_onclick(event) {
  const feed_id = parseInt(event.target.value, 10);

  const session = new cdb.CDB();
  await session.open();
  await ops.deactivate_feed(session, feed_id, 'manual');
  session.close();

  // TODO: this should be done in the event handler instead of here

  // Deactivate the corresponding element in the view
  const item_selector = 'li[feed="' + feed_id + '"]';
  const item_element = document.querySelector(item_selector);
  item_element.setAttribute('inactive', 'true');
  section_show_by_id('subs-list-section');
}

function menu_item_onclick(event) {
  // The listener is attached to the item, but that not be what triggered
  // the click event of event.target, so use currentTarget to get the element
  // where the listener is attached
  section_show(event.currentTarget);
}

function enable_notifications_checkbox_onclick(event) {
  tls.write_boolean('show_notifications', event.target.checked);
}

function enable_bg_processing_checkbox_onclick(event) {
  if (event.target.checked) {
    platform.request_permission('background');
  } else {
    platform.remove_permission('background');
  }
}

// TODO: this should be using a configuration variable and instead the
// permission should be permanently defined.
async function enable_bg_processing_checkbox_init() {
  const checkbox = document.getElementById('enable-background');
  checkbox.onclick = enable_bg_processing_checkbox_onclick;
  checkbox.checked = await platform.has_permission('background');
}

function bg_image_menu_onchange(event) {
  const path = event.target.value;
  if (path) {
    tls.write_string('bg_image', path);
  } else {
    tls.remove('bg_image');
  }
}

function column_count_menu_onchange(event) {
  const count = event.target.value;
  if (count) {
    tls.write_string('column_count', count);
  } else {
    tls.remove('column_count');
  }
}

function entry_bg_color_input_oninput(event) {
  const color = event.target.value;
  if (color) {
    tls.write_string('bg_color', color);
  } else {
    tls.remove('bg_color');
  }
}

function entry_margin_slider_onchange(event) {
  const margin = event.target.value;
  if (margin) {
    tls.write_string('padding', margin);
  } else {
    tls.remove('padding');
  }
}

function header_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    tls.write_string('header_font_size', size);
  } else {
    tls.remove('header_font_size');
  }
}

function body_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    tls.write_string('body_font_size', size);
  } else {
    tls.remove('body_font_size');
  }
}

function justify_text_checkbox_onchange(event) {
  tls.write_boolean('justify_text', event.target.checked);
}

function body_line_height_input_oninput(event) {
  const height = event.target.value;
  if (height) {
    tls.write_string('body_line_height', height);
  } else {
    tls.remove('body_line_height');
  }
}



{  // Start on module load init
  // TODO: use single event listener on list itself instead
  const menu_items = document.querySelectorAll('#navigation-menu li');
  for (const menuItem of menu_items) {
    menuItem.onclick = menu_item_onclick;
  }

  const enable_notes_checkbox = document.getElementById('enable-notifications');
  enable_notes_checkbox.checked = tls.read_boolean('show_notifications');
  enable_notes_checkbox.onclick = enable_notifications_checkbox_onclick;

  enable_bg_processing_checkbox_init();

  const idle_poll_checkbox = document.getElementById('enable-idle-check');
  idle_poll_checkbox.checked = tls.read_boolean('only_poll_if_idle');
  idle_poll_checkbox.onclick = event =>
      tls.write_boolean('only_poll_if_idle', event.target.checked);

  feed_list_init();

  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.onclick = unsubscribe_button_onclick;

  const activate_button = document.getElementById('details-activate');
  activate_button.onclick = activate_feed_button_onclick;

  const deactivate_button = document.getElementById('details-deactivate');
  deactivate_button.onclick = deactivate_feed_button_onclick;

  const subscription_form = document.getElementById('subscription-form');
  subscription_form.onsubmit = subscribe_form_onsubmit;

  // Init background image menu
  {
    const bg_image_menu = document.getElementById('entry-background-image');
    bg_image_menu.onchange = bg_image_menu_onchange;
    let option = document.createElement('option');
    option.value = '';
    option.textContent = 'Use background color';
    bg_image_menu.appendChild(option);

    let current_path = tls.read_string('bg_image');
    const background_images = tls.read_array('background_images');
    for (const path of background_images) {
      let option = document.createElement('option');
      option.value = path;
      option.textContent = path;
      option.selected = current_path === path;
      bg_image_menu.appendChild(option);
    }
  }

  {
    const column_count_menu = document.getElementById('column-count');
    column_count_menu.onchange = column_count_menu_onchange;
    const column_count_options = [1, 2, 3];
    const current_column_count = tls.read_int('column_count');
    for (const column_count of column_count_options) {
      const option = document.createElement('option');
      option.value = column_count;
      option.selected = column_count === current_column_count;
      option.textContent = column_count;
      column_count_menu.appendChild(option);
    }
  }

  const bg_color_input = document.getElementById('entry-background-color');
  bg_color_input.oninput = entry_bg_color_input_oninput;
  const bg_color = tls.read_string('bg_color');
  if (bg_color) {
    bg_color_input.value = bg_color;
  }

  const entry_margin_input = document.getElementById('entry-margin');
  entry_margin_input.onchange = entry_margin_slider_onchange;
  const margin = tls.read_int('padding', 0);
  if (!isNaN(margin)) {
    entry_margin_input.value = margin;
  }

  const justify_checkbox = document.getElementById('justify-text');
  justify_checkbox.checked = tls.read_boolean('justify_text');
  justify_checkbox.onchange = event =>
      tls.write_boolean('justify_text', event.target.checked);

  const header_size_range = document.getElementById('header-font-size');
  header_size_range.onchange = header_font_size_slider_onchange;
  const header_font_size = tls.read_int('header_font_size');
  if (!isNaN(header_font_size)) {
    header_size_range.value = header_font_size;
  }

  const body_size_range = document.getElementById('body-font-size');
  body_size_range.onchange = body_font_size_slider_onchange;
  const body_font_size = tls.read_int('body_font_size');
  if (!isNaN(body_font_size)) {
    body_size_range.value = body_font_size;
  }

  const body_line_height_input = document.getElementById('body-line-height');
  body_line_height_input.oninput = body_line_height_input_oninput;
  const body_line_height = tls.read_int('body_line_height');
  if (!isNaN(body_line_height)) {
    body_line_height_input.value = body_line_height;
  }

  const manifest = chrome.runtime.getManifest();
  const ext_name_element = document.getElementById('extension-name');
  ext_name_element.textContent = manifest.name;
  const ext_version_element = document.getElementById('extension-version');
  ext_version_element.textValue = manifest.version;
  const ext_author_element = document.getElementById('extension-author');
  ext_author_element.textContent = manifest.author;
  const ext_desc_element = document.getElementById('extension-description');
  ext_desc_element.textContent = manifest.description || '';
  const ext_url_element = document.getElementById('extension-homepage');
  ext_url_element.textContent = manifest.homepage_url;

  section_show_by_id('subs-list-section');
}  // End on module load init
