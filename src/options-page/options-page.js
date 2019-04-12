import About from '/src/options-page/about.js';
import DisplaySettingsForm from '/src/options-page/display-settings-form.js';
import FeedList from '/src/options-page/feed-list.js';
import GeneralSettingsForm from '/src/options-page/general-settings-form.js';
import NavMenu from '/src/options-page/nav-menu.js';
import SubscriptionForm from '/src/options-page/subscription-form.js';
import refreshBadge from '/src/refresh-badge.js';

let currentSection;

const navMenu = new NavMenu();
navMenu.init();
navMenu.onclick = function navMenuOnclick(item) {
  showSection(item);
};

const feedList = new FeedList();
feedList.init(document.getElementById('section-subscriptions'));
feedList.onappendCallback = function feedListOnappendCallback() {
  feedCountUpdate();
};

feedList.onclickCallback = function feedListOnclickCallback() {
  showSectionByElementId('mi-feed-details');
  // For longer feed lists, details will be out of view, so we need to scroll
  // back to the top
  scrollTo(0, 0);
};

feedList.onremoveCallback = feedId => feedCountUpdate();
feedList.unsubscribeCallback = feedId => showSectionByElementId('subs-list-section');
feedList.activateCallback = feedId => showSectionByElementId('subs-list-section');
feedList.deactivateCallback = feedId => showSectionByElementId('subs-list-section');

const subscriptionForm = new SubscriptionForm();
subscriptionForm.init(document.getElementById('section-add-subscription'));
subscriptionForm.onsubscribe = function subscriptionFormOnsubscribe(feed) {
  feedList.appendFeed(feed);
  showSectionByElementId('subs-list-section');
};

const displaySettingsForm = new DisplaySettingsForm();
displaySettingsForm.init(document.getElementById('section-display-settings'));

const generalSettingsForm = new GeneralSettingsForm();
generalSettingsForm.init(document.getElementById('section-general-settings'));

const about = new About();
about.init(document.getElementById('about'));

const channel = new BroadcastChannel('reader');
channel.onmessage = function (event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  const { type } = message;

  if (type === 'resource-created') {
    refreshBadge().catch(console.warn);
  } else if (type === 'resource-updated') {
    refreshBadge().catch(console.warn);
  } else if (type === 'resource-deleted') {
    refreshBadge().catch(console.warn);
  } else {
    console.warn('Unknown message type', type);
  }
};

channel.onmessageerror = function (event) {
  console.warn(event);
};

function showSection(menuItemElement) {
  if (menuItemElement && menuItemElement !== navMenu.currentItem) {
    if (navMenu.currentItem) {
      navMenu.currentItem.classList.remove('navigation-item-selected');
    }
    if (currentSection) {
      currentSection.style.display = 'none';
    }
    menuItemElement.classList.add('navigation-item-selected');
    const sectionId = menuItemElement.getAttribute('section');
    const sectionElement = document.getElementById(sectionId);

    if (!sectionElement) {
      console.error('No section element found with id', sectionId);
      return;
    }

    sectionElement.style.display = 'block';
    navMenu.currentItem = menuItemElement;
    currentSection = sectionElement;
  }
}

function showSectionByElementId(id) {
  showSection(document.getElementById(id));
}

function feedCountUpdate() {
  const count = feedList.count();
  const element = document.getElementById('subscription-count');
  element.textContent = ` ${count > 50 ? '(50+)' : `(${count})`}`;
}

showSectionByElementId('subs-list-section');
