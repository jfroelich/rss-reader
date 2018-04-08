import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {element_fade} from '/src/lib/dom/element-fade.js';
import {html_truncate} from '/src/lib/html-truncate/html-truncate.js';
import * as perm from '/src/lib/permissions/permissions.js';
import {feed_peek_url} from '/src/objects/feed.js';
import {deactivate_feed} from '/src/ops/deactivate-feed.js';
import {delete_feed} from '/src/ops/delete-feed.js';
import {find_feed_by_id} from '/src/ops/find-feed-by-id.js';
import {get_feeds} from '/src/ops/get-feeds.js';
import {rdr_activate_feed} from '/src/ops/rdr-activate-feed.js';
import {rdr_create_conn} from '/src/ops/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/ops/rdr-create-icon-conn.js';
import {rdr_subscribe} from '/src/ops/subscribe.js';
import * as PageStyle from '/src/views/slideshow-page/page-style-settings.js';

// clang-format off
const BG_IMAGES = [
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
// clang-format on


// View state
let current_menu_item;
let current_section;

const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  if (!event) {
    return;
  }

  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  switch (message.type) {
    case 'display-settings-changed':
      PageStyle.page_style_onchange(event);
      break;
    default:
      break;
  }
};

channel.onmessageerror = function(event) {
  console.warn(event);
};

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
  await element_fade(monitor_element, duration_secs, delay_secs);
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
    element_fade(container, duration, delay);
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
  let feed_title = feed.title || 'Untitled';
  feed_title = html_truncate(feed_title, 300);
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

async function feed_list_item_onclick(event) {
  const feed_list_item_element = event.currentTarget;
  const feed_id_string = feed_list_item_element.getAttribute('feed');
  const feed_id = parseInt(feed_id_string, 10);

  const conn = await rdr_create_conn();
  const feed = await find_feed_by_id(conn, feed_id);
  conn.close();

  const title_element = document.getElementById('details-title');
  title_element.textContent = feed.title || feed.link || 'Untitled';

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
  feed_url_element.textContent = feed_peek_url(feed);
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
  window.scrollTo(0, 0);
}

async function subscribe_form_onsubmit(event) {
  event.preventDefault();

  const monitor_element = document.getElementById('submon');
  if (!monitor_element) {
    return false;
  }

  if (monitor_element.style.display === 'block') {
    return false;
  }

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
    console.warn(exception);
    return false;
  }

  subscribe_url_input_element.value = '';
  subscription_monitor_show();
  subscription_monitor_append_message(`Subscribing to ${subscribe_url.href}`);

  let fetch_timeout, notify_flag = true;
  const conn_promises =
      Promise.all([rdr_create_conn(), rdr_create_icon_conn()]);
  const [rconn, iconn] = await conn_promises;
  const feed = await rdr_subscribe(
      rconn, iconn, channel, void console, fetch_timeout, notify_flag,
      subscribe_url);
  rconn.close();
  iconn.close();

  feed_list_append_feed(feed);
  subscription_monitor_append_message('Subscribed to ' + feed_peek_url(feed));
  subscription_monitor_hide();
  section_show_by_id('subs-list-section');
  return false;
}

async function feed_list_init() {
  const title_sort_flag = true;
  const conn = await rdr_create_conn();
  const feeds = await get_feeds(conn, title_sort_flag);
  conn.close();

  for (const feed of feeds) {
    // TODO: I think this is actually a concern of feed_list_append_feed? I do
    // not think this needs to be done here, but not sure
    feed.title = feed.title || 'Untitled';
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

// @param feed_id {Number}
function feed_list_remove_feed_by_id(feed_id) {
  const feed_element =
      document.querySelector(`#feedlist li[feed="${feed_id}"]`);

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

  const reason_text = 'unsubscribe';
  const conn = await rdr_create_conn();
  const result =
      await delete_feed(conn, channel, void console, feed_id, reason_text);
  conn.close();

  feed_list_remove_feed_by_id(feed_id);
  section_show_by_id('subs-list-section');
}

async function activate_feed_button_onclick(event) {
  const feed_id = parseInt(event.target.value, 10);

  const ctx = {};
  ctx.conn = await rdr_create_conn();
  ctx.channel = channel;
  ctx.console = console_stub;
  await rdr_activate_feed.call(ctx, feed_id);
  ctx.conn.close();

  // Mark the corresponding feed element displayed in the view as active
  const item_element = document.querySelector('li[feed="' + feed_id + '"]');
  if (item_element) {
    item_element.removeAttribute('inactive');
  }

  section_show_by_id('subs-list-section');
}

async function deactivate_feed_button_onclick(event) {
  const feed_id = parseInt(event.target.value, 10);
  const reason = 'click';

  const conn = await rdr_create_conn();
  await deactivate_feed(conn, channel, feed_id, reason);
  conn.close();

  // Deactive the corresponding feed element in the view
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
  if (event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}

function enable_bg_processing_checkbox_onclick(event) {
  if (event.target.checked) {
    perm.request('background');
  } else {
    perm.remove('background');
  }
}

async function enable_bg_processing_checkbox_init() {
  const checkbox = document.getElementById('enable-background');

  // TODO: move this comment to github, make a note of the general pattern
  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.

  checkbox.onclick = enable_bg_processing_checkbox_onclick;
  checkbox.checked = await perm.has('background');
}

function restrict_idle_polling_checkbox_onclick(event) {
  if (event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

function bg_image_menu_onchange(event) {
  const path = event.target.value;
  if (path) {
    localStorage.BG_IMAGE = path;
  } else {
    delete localStorage.BG_IMAGE;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function column_count_menu_onchange(event) {
  const count = event.target.value;
  if (count) {
    localStorage.COLUMN_COUNT = count;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function entry_bg_color_input_oninput(event) {
  const color = event.target.value;
  if (color) {
    localStorage.BG_COLOR = color;
  } else {
    delete localStorage.BG_COLOR;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function entry_margin_slider_onchange(event) {
  const margin = event.target.value;
  console.log('entry_margin_slider_onchange new value', margin);

  if (margin) {
    localStorage.PADDING = margin;
  } else {
    delete localStorage.PADDING;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function header_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    localStorage.HEADER_FONT_SIZE = size;
  } else {
    delete localStorage.HEADER_FONT_SIZE;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function body_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    localStorage.BODY_FONT_SIZE = size;
  } else {
    delete localStorage.BODY_FONT_SIZE;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function justify_text_checkbox_onchange(event) {
  if (event.target.checked) {
    localStorage.JUSTIFY_TEXT = '1';
  } else {
    delete localStorage.JUSTIFY_TEXT;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function body_line_height_input_oninput(event) {
  const height = event.target.value;
  if (height) {
    localStorage.BODY_LINE_HEIGHT = height;
  } else {
    delete localStorage.BODY_LINE_HEIGHT;
  }

  channel.postMessage({type: 'display-settings-changed'});
}

function options_page_init() {
  PageStyle.page_style_onload();

  // Attach click handlers to menu items
  // TODO: use single event listener on list itself instead
  const menu_items = document.querySelectorAll('#navigation-menu li');
  for (const menuItem of menu_items) {
    menuItem.onclick = menu_item_onclick;
  }

  // Init Enable notifications checkbox
  const enable_notifications_checkbox =
      document.getElementById('enable-notifications');
  enable_notifications_checkbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
  enable_notifications_checkbox.onclick = enable_notifications_checkbox_onclick;

  enable_bg_processing_checkbox_init();

  const restrict_idle_polling_checkbox =
      document.getElementById('enable-idle-check');
  restrict_idle_polling_checkbox.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
  restrict_idle_polling_checkbox.onclick =
      restrict_idle_polling_checkbox_onclick;

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

    const current_bg_image_path = localStorage.BG_IMAGE;
    const bg_image_relative_path_offset = '/images/'.length;
    for (const path of BG_IMAGES) {
      let option = document.createElement('option');
      option.value = path;
      option.textContent = path.substring(bg_image_relative_path_offset);
      option.selected = current_bg_image_path === path;
      bg_image_menu.appendChild(option);
    }
  }

  {
    const column_count_menu = document.getElementById('column-count');
    column_count_menu.onchange = column_count_menu_onchange;
    const column_count_options = ['1', '2', '3'];
    const current_column_count = localStorage.COLUMN_COUNT
    for (const column_count of column_count_options) {
      const option = document.createElement('option');
      option.value = column_count;
      option.selected = column_count === current_column_count;
      option.textContent = column_count;
      column_count_menu.appendChild(option);
    }
  }

  const bg_color_input = document.getElementById('entry-background-color');
  if (localStorage.BG_COLOR) {
    bg_color_input.value = localStorage.BG_COLOR;
  } else {
    bg_color_input.removeAttribute('value');
  }
  bg_color_input.oninput = entry_bg_color_input_oninput;

  const entry_margin_input = document.getElementById('entry-margin');
  entry_margin_input.value = localStorage.PADDING || '10';
  entry_margin_input.onchange = entry_margin_slider_onchange;

  const justify_text_checkbox = document.getElementById('justify-text');
  justify_text_checkbox.checked = 'JUSTIFY_TEXT' in localStorage;
  justify_text_checkbox.onchange = justify_text_checkbox_onchange;

  const body_line_height_input = document.getElementById('body-line-height');
  body_line_height_input.oninput = body_line_height_input_oninput;
  const current_body_line_height = parseInt(localStorage.BODY_LINE_HEIGHT, 10);
  if (!isNaN(current_body_line_height)) {
    body_line_height_input.value = (current_body_line_height / 10).toFixed(2);
  }

  const manifest = chrome.runtime.getManifest();
  const extension_name_element = document.getElementById('extension-name');
  extension_name_element.textContent = manifest.name;
  const extension_version_element =
      document.getElementById('extension-version');
  extension_version_element.textValue = manifest.version;
  const extension_author_element = document.getElementById('extension-author');
  extension_author_element.textContent = manifest.author;
  const extension_description_element =
      document.getElementById('extension-description');
  extension_description_element.textContent = manifest.description || '';
  const extension_url_element = document.getElementById('extension-homepage');
  extension_url_element.textContent = manifest.homepage_url;

  section_show_by_id('subs-list-section');
}

options_page_init();
