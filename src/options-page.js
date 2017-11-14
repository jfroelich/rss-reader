// Options page view module

import assert from "/src/assert.js";
import {entryCSSInit, entryCSSOnChange} from "/src/entry-css.js";
import {
  hasBrowserPermission,
  requestBrowserPermission,
  removeBrowserPermission
} from "/src/extension.js";
import {feedAppendURL, feedIsValidId, feedPeekURL} from "/src/feed.js";
import FONTS from "/src/fonts.js";
import {truncate as htmlTruncate} from "/src/html.js";
import * as mime from "/src/mime.js";
import {
  optionsPageErrorMessageHide,
  optionsPageErrorMessageShow
} from "/src/options-page-error-message.js";
import {optionsPageExportOPML} from "/src/options-page-export-opml.js";
import OPTIONS_PAGE_IMAGE_PATHS from "/src/options-page-image-paths.js";
import {
  optionsPageSubscriptionMonitorShow,
  optionsPageSubscriptionMonitorAppendMessage,
  optionsPageSubscriptionMonitorHide
} from "/src/options-page-subscription-monitor.js";
import * as rdb from "/src/rdb.js";
import {readerImportFiles} from "/src/reader-import.js";
import {parseInt10} from "/src/string.js";
import {SubscribeRequest} from "/src/subscribe-request.js";


// Navigation tracking
let optionsPageCurrentMenuItem;
let optionsPageCurrentSectionElement;

const optionsPageSettingsChannel = new BroadcastChannel('settings');
optionsPageSettingsChannel.onmessage = function(event) {
  console.debug('received settings channel message:', event);
  if(event.data === 'changed') {
    entryCSSOnChange(event);
  }
};

optionsPageSettingsChannel.onmessageerror = function(event) {
  console.error(event);
};


function dispatchSettingsChangedEvent() {

  // TODO: once the loopback issue is fixed, do not double call
  // HACK: for now, hard call
  entryCSSOnChange();

  optionsPageSettingsChannel.postMessage('changed');
}

function showSection(menuItemElement) {
  assert(menuItemElement);

  if(optionsPageCurrentMenuItem === menuItemElement) {
    return;
  }

  if(optionsPageCurrentMenuItem) {
    optionsPageCurrentMenuItem.classList.remove('navigation-item-selected');
  }

  if(optionsPageCurrentSectionElement) {
    optionsPageCurrentSectionElement.style.display = 'none';
  }

  menuItemElement.classList.add('navigation-item-selected');

  // Show the new section
  const sectionId = menuItemElement.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  assert(sectionElement, 'No matching section ' + sectionId);

  sectionElement.style.display = 'block';

  // Update the global tracking vars
  optionsPageCurrentMenuItem = menuItemElement;
  optionsPageCurrentSectionElement = sectionElement;
}

function optionsPageShowSectionId(id) {
  showSection(document.getElementById(id));
}

function optionsPageUpdateFeedCount() {
  const feedListElement = document.getElementById('feedlist');
  const count = feedListElement.childElementCount;
  const feedCountElement = document.getElementById('subscription-count');
  if(count > 50) {
    feedCountElement.textContent = ' (50+)';
  } else {
    feedCountElement.textContent = ` (${count})`;
  }
}

function optionsPageFeedListAppendFeed(feed) {
  const itemElement = document.createElement('li');
  itemElement.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  itemElement.setAttribute('feed', feed.id);
  if(feed.description) {
    itemElement.setAttribute('title', feed.description);
  }

  itemElement.onclick = optionsPageFeedListItemOnclick;

  if(feed.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.src = feed.faviconURLString;
    if(feed.title) {
      faviconElement.title = feed.title;
    }

    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  let feedTitle = feed.title || 'Untitled';

  // TODO: handle the parse error, this is near root scope
  feedTitle = htmlTruncate(feedTitle, 300);
  titleElement.textContent = feedTitle;
  itemElement.appendChild(titleElement);
  const feedListElement = document.getElementById('feedlist');
  const normalTitle = feedTitle.toLowerCase();

  // Insert the feed element into the proper position in the list
  let inserted = false;
  for(const childNode of feedListElement.childNodes) {
    let keyString = childNode.getAttribute('sort-key');
    keyString = keyString || '';
    keyString = keyString.toLowerCase();

    if(indexedDB.cmp(normalTitle, keyString) < 1) {
      feedListElement.insertBefore(itemElement, childNode);
      inserted = true;
      break;
    }
  }

  if(!inserted) {
    feedListElement.appendChild(itemElement);
    inserted = true;
  }

  assert(inserted);
  optionsPageUpdateFeedCount();
}

async function optionsPageFeedListItemOnclick(event) {
  // Use current target to capture the element with the feed attribute
  const feedListItem = event.currentTarget;
  const feedIdString = feedListItem.getAttribute('feed');
  const feedIdNumber = parseInt10(feedIdString);

  // TODO: assert using feedIsValidId
  assert(!isNaN(feedIdNumber));

  // Load feed details from the database
  let conn, feed;
  try {
    conn = await rdb.open();
    feed = await rdb.findFeedById(conn, feedIdNumber);
  } catch(error) {
    console.warn(error);
    // TODO: visual feedback?
    return;
  } finally {
    rdb.close(conn);
  }

  const titleElement = document.getElementById('details-title');
  titleElement.textContent = feed.title || feed.link || 'Untitled';

  const faviconElement = document.getElementById('details-favicon');
  if(feed.faviconURLString) {
    console.debug('setting favicon element to ', feed.faviconURLString);
    faviconElement.setAttribute('src', feed.faviconURLString);
  } else {

    // TODO: set to default favicon or something instead??? This doesn't make sense, this
    // curretnly causes a broken image to appear

    console.debug('removing faviconElement source');
    faviconElement.removeAttribute('src');
  }

  const descriptionElement = document.getElementById('details-feed-description');
  if(feed.description) {
    descriptionElement.textContent = feed.description;
  } else {
    descriptionElement.textContent = '';
  }

  const feedURLElement = document.getElementById('details-feed-url');
  feedURLElement.textContent = feedPeekURL(feed);
  const feedLinkElement = document.getElementById('details-feed-link');
  feedLinkElement.textContent = feed.link || '';
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.value = '' + feed.id;

  // TODO: show num entries, num unread/red, etc
  // TODO: show dateLastModified, datePublished, dateCreated, dateUpdated

  optionsPageShowSectionId('mi-feed-details');

  // Ensure the details are visible
  window.scrollTo(0,0);
}

async function optionsPageSubscribeFormOnSubmit(event) {
  event.preventDefault();

  const monitorElement = document.getElementById('submon');
  if(monitorElement) {
    console.debug('monitorElement.style.display: "%s"', monitorElement.style.display);
  }

  if(monitorElement && monitorElement.style.display === 'block') {
    console.debug('in progress, canceling submit');
    return false;
  }

  // TODO: rename, this is no longer query, simply a text input that should
  // contain a url
  const queryElement = document.getElementById('subscribe-url');
  let queryString = queryElement.value;
  queryString = queryString || '';
  queryString = queryString.trim();

  if(!queryString) {
    return false;
  }

  let url = null;
  try {
    url = new URL(queryString);
  } catch(exception) {
    // TODO: show error like "Please enter a valid url"
    console.warn(exception);
    return false;
  }

  // Reset the input
  queryElement.value = '';

  optionsPageSubscriptionMonitorShow();

  // This is safe because it is coming from the parsed url and not directly
  // from user input, and would have failed earlier.
  optionsPageSubscriptionMonitorAppendMessage(`Subscribing to ${url.href}`);

  const feed = feedCreate();
  feedAppendURL(feed, url.href);

  let subscribedFeed;

  const request = new SubscribeRequest();

  try {
    await request.connect();
    subscribedFeed = await request.subscribe(feed);
  } catch(error) {
    // TODO: show a visual error message.
    console.warn(error);
    optionsPageSubscriptionMonitorHide();
    return;
  } finally {
    request.close();
  }

  assert(subscribedFeed);
  optionsPageFeedListAppendFeed(subscribedFeed);
  const feedURL = feedPeekURL(subscribedFeed);

  // This is safe. feedURL comes from a string that has undergone
  // deserialization into a URL object and back to a string. Unsafe user input
  // would have triggered a parsing error.
  optionsPageSubscriptionMonitorAppendMessage(`Subscribed to ${feedURL}`);
  optionsPageSubscriptionMonitorHide();
  optionsPageShowSectionId('subs-list-section');

  // Signal form should not be submitted
  return false;
}

async function optionsPageFeedListInit() {
  const noFeedsElement = document.getElementById('nosubs');
  const feedListElement = document.getElementById('feedlist');
  let conn, feeds;
  try {
    conn = await rdb.open();
    feeds = await rdb.getFeeds(conn);
  } catch(error) {
    // TODO: react to error
    console.warn(error);
  } finally {
    rdb.close(conn);
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
    optionsPageFeedListAppendFeed(feed);
  }

  if(!feeds.length) {
    noFeedsElement.style.display = 'block';
    feedListElement.style.display = 'none';
  } else {
    noFeedsElement.style.display = 'none';
    feedListElement.style.display = 'block';
  }
}

// @param feedId {Number}
function optionsPageFeedListRemoveFeed(feedId) {
  const feedElement = document.querySelector(
    `#feedlist li[feed="${feedId}"]`);

  assert(feedElement);

  feedElement.removeEventListener('click', optionsPageFeedListItemOnclick);
  feedElement.remove();

  // Upon removing the feed, update the displayed number of feeds.
  optionsPageUpdateFeedCount();

  // Upon removing the feed, update the state of the feed list.
  // If the feed list has no items, hide it and show a message instead
  const feedListElement = document.getElementById('feedlist');
  if(!feedListElement.childElementCount) {
    feedListElement.style.display = 'none';

    const noFeedsElement = document.getElementById('nosubs');
    noFeedsElement.style.display = 'block';
  }
}

async function optionsPageUnsubscribeButtonOnclick(event) {
  const feedId = parseInt10(event.target.value);
  assert(feedIsValidId(feedId));
  const request = new SubscribeRequest();
  try {
    request.readerConn = await rdb.open();
    await request.remove(feedId);
  } catch(error) {
    // TODO: visually react to unsubscribe error
    console.warn(error);
    return;
  } finally {
    rdb.close(request.readerConn);
  }

  optionsPageFeedListRemoveFeed(feedId);
  optionsPageShowSectionId('subs-list-section');
}

function optionsPageImportOPMLButtonOnclick(event) {
  const uploaderInput = document.createElement('input');
  uploaderInput.setAttribute('type', 'file');
  uploaderInput.setAttribute('accept', mime.XML);
  uploaderInput.addEventListener('change', optionsPageImportOPMLUploaderOnchange);
  uploaderInput.click();
}

async function optionsPageImportOPMLUploaderOnchange(event) {
  // TODO: show operation started

  const uploaderInput = event.target;

  try {
    await readerImportFiles(uploaderInput.files);
  } catch(error) {
    // TODO: visual feedback in event an error
    console.warn(error);
    return;
  }

  // TODO: show operation completed successfully
  // TODO: refresh feed list
}

async function optionsPageExportOPMLButtonOnclick(event) {
  try {
    await optionsPageExportOPML();
  } catch(error) {
    // TODO: handle error visually
    console.warn(error);
  }
}

function menuItemOnclick(event) {
  const clickedElement = event.target;
  const sectionElement = event.currentTarget;
  showSection(sectionElement);
}

function enableNotificationsCheckboxOnclick(event) {
  if(event.target.checked) {
    localStorage.SHOW_NOTIFICATIONS = '1';
  } else {
    delete localStorage.SHOW_NOTIFICATIONS;
  }
}

function optionsPageEnableBgProcessingCheckboxOnclick(event) {
  if(event.target.checked) {
    requestBrowserPermission('background');
  } else {
    removeBrowserPermission('background');
  }
}

async function initBgProcessingCheckbox() {
  const checkbox = document.getElementById('enable-background');
  assert(checkbox);

  // TODO: this should be using a local storage variable and instead the
  // permission should be permanently defined.

  checkbox.onclick = optionsPageEnableBgProcessingCheckboxOnclick;
  checkbox.checked = await hasBrowserPermission('background');
}

function optionsPageRestrictIdlePollingCheckboxOnclick(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

function optionsPageBgImageMenuOnchange(event) {
  const path = event.target.value;
  if(path) {
    localStorage.BG_IMAGE = path;
  } else {
    delete localStorage.BG_IMAGE;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageHeaderFontMenuOnchange(event){
  const font = event.target.value;
  if(font) {
    localStorage.HEADER_FONT_FAMILY = font;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageBodyFontMenuOnchange(event) {
  const font = event.target.value;
  if(font) {
    localStorage.BODY_FONT_FAMILY = font;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageColumnCountMenuOnchange(event) {
  const count = event.target.value;
  if(count) {
    localStorage.COLUMN_COUNT = count;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageEntryBgColorInputOninput(event) {
  const color = event.target.value;
  if(color) {
    localStorage.BG_COLOR = color;
  } else {
    delete localStorage.BG_COLOR;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageEntryMarginSliderOnchange(event) {
  const margin = event.target.value;
  console.log('optionsPageEntryMarginSliderOnchange new value', margin);

  if(margin) {
    localStorage.PADDING = margin;
  } else {
    delete localStorage.PADDING;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageHeaderFontSizeSliderOnchange(event) {
  const size = event.target.value;
  if(size) {
    localStorage.HEADER_FONT_SIZE = size;
  } else {
    delete localStorage.HEADER_FONT_SIZE;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageBodyFontSizeSliderOnchange(event) {
  const size = event.target.value;
  if(size) {
    localStorage.BODY_FONT_SIZE = size;
  } else {
    delete localStorage.BODY_FONT_SIZE;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageJustifyTextCheckboxOnchange(event) {
  if(event.target.checked) {
    localStorage.JUSTIFY_TEXT = '1';
  } else {
    delete localStorage.JUSTIFY_TEXT;
  }

  dispatchSettingsChangedEvent();
}

function optionsPageBodyHeightInputOninput(event) {
  const height = event.target.value;
  if(height) {
    localStorage.BODY_LINE_HEIGHT = height;
  } else {
    delete localStorage.BODY_LINE_HEIGHT;
  }

  dispatchSettingsChangedEvent();
}



// Initialization

entryCSSInit();

// Attach click handlers to menu items
// TODO: use single event listener on list itself instead
const menuItems = document.querySelectorAll('#navigation-menu li');
for(const menuItem of menuItems) {
  menuItem.onclick = menuItemOnclick;
}

// Init Enable notifications checkbox
const enableNotificationsCheckbox = document.getElementById('enable-notifications');
enableNotificationsCheckbox.checked = 'SHOW_NOTIFICATIONS' in localStorage;
enableNotificationsCheckbox.onclick = enableNotificationsCheckboxOnclick;

initBgProcessingCheckbox();

const enableRestrictIdlePollingCheckbox = document.getElementById('enable-idle-check');
enableRestrictIdlePollingCheckbox.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
enableRestrictIdlePollingCheckbox.onclick = optionsPageRestrictIdlePollingCheckboxOnclick;

const exportOPMLButton = document.getElementById('button-export-opml');
exportOPMLButton.onclick = optionsPageExportOPMLButtonOnclick;
const importOPMLButton = document.getElementById('button-import-opml');
importOPMLButton.onclick = optionsPageImportOPMLButtonOnclick;

optionsPageFeedListInit();

// Init feed details section unsubscribe button click handler
const unsubscribeButton = document.getElementById('details-unsubscribe');
unsubscribeButton.onclick = optionsPageUnsubscribeButtonOnclick;

// Init the subscription form section
const subscriptionForm = document.getElementById('subscription-form');
subscriptionForm.onsubmit = optionsPageSubscribeFormOnSubmit;


// Init background image menu
{
  const backgroundImageMenu = document.getElementById('entry-background-image');
  backgroundImageMenu.onchange = optionsPageBgImageMenuOnchange;
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  backgroundImageMenu.appendChild(option);

  const currentBgImagePath = localStorage.BG_IMAGE;
  const bgImagePathOffset = '/images/'.length;
  for(const path of OPTIONS_PAGE_IMAGE_PATHS) {
    let option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring(bgImagePathOffset);
    option.selected = currentBgImagePath === path;
    backgroundImageMenu.appendChild(option);
  }
}

{
  const headerFontMenu = document.getElementById('select-header-font');
  headerFontMenu.onchange = optionsPageHeaderFontMenuOnchange;
  let option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  headerFontMenu.appendChild(option);
  const currentHeaderFont = localStorage.HEADER_FONT_FAMILY;
  for(const font of FONTS) {
    let option = document.createElement('option');
    option.value = font;
    option.selected = font === currentHeaderFont;
    option.textContent = font;
    headerFontMenu.appendChild(option);
  }
}

{
  const bodyFontMenu = document.getElementById('select-body-font');
  bodyFontMenu.onchange = optionsPageBodyFontMenuOnchange;
  let option = document.createElement('option');
  option.textContent = 'Use Chrome font settings';
  bodyFontMenu.appendChild(option);

  const currentBodyFont = localStorage.BODY_FONT_FAMILY;
  for(const font of FONTS) {
    option = document.createElement('option');
    option.value = font;
    option.selected = font === currentBodyFont;
    option.textContent = font;
    bodyFontMenu.appendChild(option);
  }
}

{
  const columnCountMenu = document.getElementById('column-count');
  columnCountMenu.onchange = optionsPageColumnCountMenuOnchange;
  const columnCounts = ['1', '2', '3'];
  const currentColumnCount = localStorage.COLUMN_COUNT
  for(const columnCount of columnCounts) {
    const option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === currentColumnCount;
    option.textContent = columnCount;
    columnCountMenu.appendChild(option);
  }
}

const bgColorInput = document.getElementById('entry-background-color');
bgColorInput.value = localStorage.BG_COLOR || '';
bgColorInput.oninput = optionsPageEntryBgColorInputOninput;

const marginInput = document.getElementById('entry-margin');
marginInput.value = localStorage.PADDING || '10';
marginInput.onchange = optionsPageEntryMarginSliderOnchange;

const headerFontSizeInput = document.getElementById('header-font-size');
headerFontSizeInput.value = localStorage.HEADER_FONT_SIZE || '1';
headerFontSizeInput.onchange = optionsPageHeaderFontSizeSliderOnchange;

const bodyFontSizeInput = document.getElementById('body-font-size');
bodyFontSizeInput.value = localStorage.BODY_FONT_SIZE || '1';
bodyFontSizeInput.onchange = optionsPageBodyFontSizeSliderOnchange;

const justifyTextCheckbox = document.getElementById('justify-text');
justifyTextCheckbox.checked = 'JUSTIFY_TEXT' in localStorage;
justifyTextCheckbox.onchange = optionsPageJustifyTextCheckboxOnchange;

const bodyLineHeightInput = document.getElementById('body-line-height');
bodyLineHeightInput.oninput = optionsPageBodyHeightInputOninput;
const bodyLineHeightNumber = parseInt10(localStorage.BODY_LINE_HEIGHT) || 10;
if(!isNaN(bodyLineHeightNumber)) {
  bodyLineHeightInput.value = (bodyLineHeightNumber / 10).toFixed(2);
}

const manifest = chrome.runtime.getManifest();
const extNameElement = document.getElementById('extension-name');
extNameElement.textContent = manifest.name;
const extVersionElement = document.getElementById('extension-version');
extVersionElement.textValue = manifest.version;
const extAuthorElement = document.getElementById('extension-author');
extAuthorElement.textContent = manifest.author;
const extDescriptionElement = document.getElementById('extension-description');
extDescriptionElement.textContent = manifest.description || '';
const extURLElement = document.getElementById('extension-homepage');
extURLElement.textContent = manifest.homepage_url;

optionsPageShowSectionId('subs-list-section');
