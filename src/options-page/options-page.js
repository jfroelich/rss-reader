import * as badge from '/src/badge.js';
import * as config from '/src/config/config.js';
import {FeedList} from '/src/options-page/feed-list.js';
import {SubscriptionForm} from '/src/options-page/subscription-form.js';

const feed_list = new FeedList();
feed_list.init(document.getElementById('section-subscriptions'));
feed_list.onappend_callback = function(feed) {
  feed_count_update();
};

feed_list.onclick_callback = function(event) {
  section_show_by_id('mi-feed-details');
  scrollTo(0, 0);
};

feed_list.onremove_callback = function(feed_id) {
  feed_count_update();
};

feed_list.unsubscribe_callback = function(feed_id) {
  section_show_by_id('subs-list-section');
};

feed_list.activate_callback = function(feed_id) {
  section_show_by_id('subs-list-section');
};

feed_list.deactivate_callback = function(feed_id) {
  section_show_by_id('subs-list-section');
};

const subscription_form = new SubscriptionForm();
subscription_form.init(document.getElementById('section-add-subscription'));
subscription_form.onsubscribe = function(feed) {
  feed_list.appendFeed(feed);
  section_show_by_id('subs-list-section');
};

function has_permission(name) {
  return new Promise(
      resolve => chrome.permissions.contains({permissions: [name]}, resolve));
}

function request_permission(name) {
  return new Promise(
      resolve => chrome.permissions.request({permissions: [name]}, resolve));
}

function remove_permission(name) {
  return new Promise(
      resolve => chrome.permissions.remove({permissions: [name]}, resolve));
}

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
    badge.badge_refresh();
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
  const count = feed_list.count();
  const feed_count_element = document.getElementById('subscription-count');
  feed_count_element.textContent = count > 50 ? ' (50+)' : ` (${count})`;
}

function menu_item_onclick(event) {
  // The listener is attached to the item, but that not be what triggered
  // the click event of event.target, so use currentTarget to get the element
  // where the listener is attached
  section_show(event.currentTarget);
}

function enable_notifications_checkbox_onclick(event) {
  config.write_boolean('show_notifications', event.target.checked);
}

function enable_bg_processing_checkbox_onclick(event) {
  if (event.target.checked) {
    request_permission('background');
  } else {
    remove_permission('background');
  }
}

// TODO: this should be using a configuration variable and instead the
// permission should be permanently defined.
// TODO: this no longer works because background is now a required permission,
// so it cannot be removed (triggers an error that appears only in the console),
// so now the app really needs to migrate to relying on a configuration variable
async function enable_bg_processing_checkbox_init() {
  const checkbox = document.getElementById('enable-background');
  checkbox.onclick = enable_bg_processing_checkbox_onclick;
  checkbox.checked = await has_permission('background');
}

function bg_image_menu_onchange(event) {
  const path = event.target.value;
  if (path) {
    config.write_string('bg_image', path);
  } else {
    config.remove('bg_image');
  }
}

function column_count_menu_onchange(event) {
  const count = event.target.value;
  if (count) {
    config.write_string('column_count', count);
  } else {
    config.remove('column_count');
  }
}

function entry_bg_color_input_oninput(event) {
  const color = event.target.value;
  if (color) {
    config.write_string('bg_color', color);
  } else {
    config.remove('bg_color');
  }
}

function entry_margin_slider_onchange(event) {
  const margin = event.target.value;
  if (margin) {
    config.write_string('padding', margin);
  } else {
    config.remove('padding');
  }
}

function header_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    config.write_string('header_font_size', size);
  } else {
    config.remove('header_font_size');
  }
}

function body_font_size_slider_onchange(event) {
  const size = event.target.value;
  if (size) {
    config.write_string('body_font_size', size);
  } else {
    config.remove('body_font_size');
  }
}

function justify_text_checkbox_onchange(event) {
  config.write_boolean('justify_text', event.target.checked);
}

function body_line_height_input_oninput(event) {
  const height = event.target.value;
  if (height) {
    config.write_string('body_line_height', height);
  } else {
    config.remove('body_line_height');
  }
}



{  // Start on module load init
  // TODO: use single event listener on list itself instead
  const menu_items = document.querySelectorAll('#navigation-menu li');
  for (const menuItem of menu_items) {
    menuItem.onclick = menu_item_onclick;
  }

  const enable_notes_checkbox = document.getElementById('enable-notifications');
  enable_notes_checkbox.checked = config.read_boolean('show_notifications');
  enable_notes_checkbox.onclick = enable_notifications_checkbox_onclick;

  enable_bg_processing_checkbox_init();

  const idle_poll_checkbox = document.getElementById('enable-idle-check');
  idle_poll_checkbox.checked = config.read_boolean('only_poll_if_idle');
  idle_poll_checkbox.onclick = event =>
      config.write_boolean('only_poll_if_idle', event.target.checked);

  // Init background image menu
  {
    const bg_image_menu = document.getElementById('entry-background-image');
    bg_image_menu.onchange = bg_image_menu_onchange;
    let option = document.createElement('option');
    option.value = '';
    option.textContent = 'Use background color';
    bg_image_menu.appendChild(option);

    let current_path = config.read_string('bg_image');
    const background_images = config.read_array('background_images');
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
    const current_column_count = config.read_int('column_count');
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
  const bg_color = config.read_string('bg_color');
  if (bg_color) {
    bg_color_input.value = bg_color;
  }

  const entry_margin_input = document.getElementById('entry-margin');
  entry_margin_input.onchange = entry_margin_slider_onchange;
  const margin = config.read_int('padding', 0);
  if (!isNaN(margin)) {
    entry_margin_input.value = margin;
  }

  const justify_checkbox = document.getElementById('justify-text');
  justify_checkbox.checked = config.read_boolean('justify_text');
  justify_checkbox.onchange = event =>
      config.write_boolean('justify_text', event.target.checked);

  const header_size_range = document.getElementById('header-font-size');
  header_size_range.onchange = header_font_size_slider_onchange;
  const header_font_size = config.read_int('header_font_size');
  if (!isNaN(header_font_size)) {
    header_size_range.value = header_font_size;
  }

  const body_size_range = document.getElementById('body-font-size');
  body_size_range.onchange = body_font_size_slider_onchange;
  const body_font_size = config.read_int('body_font_size');
  if (!isNaN(body_font_size)) {
    body_size_range.value = body_font_size;
  }

  const body_line_height_input = document.getElementById('body-line-height');
  body_line_height_input.oninput = body_line_height_input_oninput;
  const body_line_height = config.read_int('body_line_height');
  if (!isNaN(body_line_height)) {
    body_line_height_input.value = body_line_height;
  }

  const manifest = get_extension_manifest();
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

function get_extension_manifest() {
  return chrome.runtime.getManifest();
}
