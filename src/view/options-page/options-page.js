import refresh_badge from '/src/extension/refresh-badge.js';
import {About} from '/src/view/options-page/about.js';
import {DisplaySettingsForm} from '/src/view/options-page/display-settings-form.js';
import {FeedList} from '/src/view/options-page/feed-list.js';
import {GeneralSettingsForm} from '/src/view/options-page/general-settings-form.js';
import {NavMenu} from '/src/view/options-page/nav-menu.js';
import {SubscriptionForm} from '/src/view/options-page/subscription-form.js';

let current_section;

const nav_menu = new NavMenu();
nav_menu.init();
nav_menu.onclick = function(item) {
  section_show(item);
};

const feed_list = new FeedList();
feed_list.init(document.getElementById('section-subscriptions'));
feed_list.onappend_callback = function(feed) {
  feed_count_update();
};

feed_list.onclick_callback = function(event) {
  section_show_by_id('mi-feed-details');
  // For longer feed lists, details will be out of view, so we need to scroll
  // back to the top
  scrollTo(0, 0);
};

feed_list.onremove_callback = feed_id => feed_count_update();
feed_list.unsubscribe_callback = feed_id =>
    section_show_by_id('subs-list-section');
feed_list.activate_callback = feed_id =>
    section_show_by_id('subs-list-section');
feed_list.deactivate_callback = feed_id =>
    section_show_by_id('subs-list-section');

const subscription_form = new SubscriptionForm();
subscription_form.init(document.getElementById('section-add-subscription'));
subscription_form.onsubscribe = function(feed) {
  feed_list.appendFeed(feed);
  section_show_by_id('subs-list-section');
};

const display_settings_form = new DisplaySettingsForm();
display_settings_form.init(document.getElementById('section-display-settings'));

const general_settings_form = new GeneralSettingsForm();
general_settings_form.init(document.getElementById('section-general-settings'));

const about = new About();
about.init(document.getElementById('about'));

const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  const type = message.type;

  if (type === 'resource-created') {
    refresh_badge().catch(console.warn);
  } else if (type === 'resource-updated') {
    refresh_badge().catch(console.warn);
  } else if (type === 'resource-deleted') {
    refresh_badge().catch(console.warn);
  } else {
    console.warn('Unknown message type', type);
  }
};

channel.onmessageerror = function(event) {
  console.warn(event);
};

function section_show(menu_item_element) {
  if (menu_item_element && menu_item_element !== nav_menu.current_item) {
    if (nav_menu.current_item) {
      nav_menu.current_item.classList.remove('navigation-item-selected');
    }
    if (current_section) {
      current_section.style.display = 'none';
    }
    menu_item_element.classList.add('navigation-item-selected');
    const section_id = menu_item_element.getAttribute('section');
    const section_element = document.getElementById(section_id);

    if (!section_element) {
      console.error('No section element found with id', section_id);
      return;
    }

    section_element.style.display = 'block';
    nav_menu.current_item = menu_item_element;
    current_section = section_element;
  }
}

function section_show_by_id(id) {
  section_show(document.getElementById(id));
}

function feed_count_update() {
  const count = feed_list.count();
  const element = document.getElementById('subscription-count');
  element.textContent = ' ' + (count > 50 ? '(50+)' : `(${count})`);
}

section_show_by_id('subs-list-section');
