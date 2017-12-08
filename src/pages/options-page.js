import assert from "/src/assert/assert.js";
import exportFeeds from "/src/backup/export-feeds.js";
import importFiles, {
  Context as ImportFilesContext
} from "/src/backup/import-opml-files.js";

// TODO: use * as Config or something like that
import {BG_IMAGES, FONTS} from "/src/config.js";
import fadeElement from "/src/dom/fade-element.js";
import FaviconCache from "/src/favicon/cache.js";
import htmlTruncate from "/src/html/truncate.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeeds from "/src/jobs/poll/poll-feeds.js";
import {
  pageStyleSettingsOnload,
  pageStyleSettingsOnchange
} from "/src/page-style/page-style-settings.js";
import {
  hasBrowserPermission,
  requestBrowserPermission,
  removeBrowserPermission
} from "/src/platform/platform.js";
import openReaderDb from "/src/reader-db/open.js";
import * as Subscriber from "/src/reader/subscribe.js";
import unsubscribe from "/src/reader/unsubscribe.js";
import * as Feed from "/src/reader-db/feed.js";
import findFeedByIdInDb from "/src/reader-db/find-feed-by-id.js";
import getFeedsFromDb from "/src/reader-db/get-feeds.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import * as MimeUtils from "/src/mime/utils.js";
import parseInt10 from "/src/utils/parse-int-10.js";

// View state
let currentMenuItem;
let currentSection;

const CHANNEL_NAME = 'reader';
const readerChannel = new BroadcastChannel(CHANNEL_NAME);
readerChannel.onmessage = function(event) {
  if(!event) {
    return;
  }

  if(!event.isTrusted) {
    return;
  }

  const message = event.data;
  if(!message) {
    return;
  }

  switch(message.type) {
  case 'display-settings-changed':
    pageStyleSettingsOnchange(event);
    break;
  default:
    // Ignore all other message types
    break;
  }
};

readerChannel.onmessageerror = function(event) {
  console.warn('Error deserializing message', event);
};

// TODO: instead of removing and re-adding, reset and reuse
function subscriptionMonitorShow() {
  let monitorElement = document.getElementById('submon');
  if(monitorElement) {
    monitorElement.remove();
  }

  monitorElement = document.createElement('div');
  monitorElement.setAttribute('id', 'submon');
  monitorElement.style.opacity = '1';
  document.body.appendChild(monitorElement);

  const progressElement = document.createElement('progress');
  progressElement.textContent = 'Working...';
  monitorElement.appendChild(progressElement);
}

function subscriptionMonitorAppendMessage(message) {
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  const monitorElement = document.getElementById('submon');
  monitorElement.appendChild(messageElement);
}

async function subscriptionMonitorHide() {
  const monitorElement = document.getElementById('submon');
  const duration = 2, delay = 1;
  await fadeElement(monitorElement, duration, delay);
  monitorElement.remove();
}

export function errorMessageShow(message, fade) {
  errorMessageHide();

  const errorElement = document.createElement('div');
  errorElement.setAttribute('id','options-error-message');

  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  errorElement.appendChild(messageElement);

  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id', 'dismiss-error-button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = errorMessageHide;
  errorElement.appendChild(dismissButton);

  if(fade) {
    errorElement.style.opacity = '0';
    document.body.appendChild(errorElement);
    const duration = 1, delay = 0;
    fadeElement(container, duration, delay);
  } else {
    errorElement.style.opacity = '1';
    errorElement.style.display = 'block';
    document.body.appendChild(errorElement);
  }
}

export function errorMessageHide() {
  const errorMessageElement = document.getElementById('options-error-message');
  if(!errorMessageElement) {
    return;
  }

  const dismissButton = document.getElementById('dismiss-error-button');
  if(dismissButton) {
    dismissButton.removeEventListener('click', errorMessageHide);
  }
  errorMessageElement.remove();
}

function showSection(menuItemElement) {
  assert(menuItemElement);

  if(currentMenuItem === menuItemElement) {
    return;
  }

  if(currentMenuItem) {
    currentMenuItem.classList.remove('navigation-item-selected');
  }

  if(currentSection) {
    currentSection.style.display = 'none';
  }

  menuItemElement.classList.add('navigation-item-selected');

  // Show the new section
  const sectionId = menuItemElement.getAttribute('section');
  const sectionElement = document.getElementById(sectionId);
  assert(sectionElement, 'No matching section ' + sectionId);

  sectionElement.style.display = 'block';

  // Update the global tracking vars
  currentMenuItem = menuItemElement;
  currentSection = sectionElement;
}

function showSectionById(id) {
  showSection(document.getElementById(id));
}

function updateFeedCount() {
  const feedListElement = document.getElementById('feedlist');
  const count = feedListElement.childElementCount;
  const feedCountElement = document.getElementById('subscription-count');
  if(count > 50) {
    feedCountElement.textContent = ' (50+)';
  } else {
    feedCountElement.textContent = ` (${count})`;
  }
}

function feedListAppendFeed(feed) {
  const itemElement = document.createElement('li');
  itemElement.setAttribute('sort-key', feed.title);

  // TODO: stop using custom feed attribute?
  // it is used on unsubscribe event to find the LI again,
  // is there an alternative?
  itemElement.setAttribute('feed', feed.id);
  if(feed.description) {
    itemElement.setAttribute('title', feed.description);
  }

  itemElement.onclick = feedListItemOnclick;

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
  updateFeedCount();
}

async function feedListItemOnclick(event) {
  // Use current target to capture the element with the feed attribute
  const feedListItem = event.currentTarget;
  const feedIdString = feedListItem.getAttribute('feed');
  const feedIdNumber = parseInt10(feedIdString);

  // TODO: assert using Feed.isValidId
  assert(!isNaN(feedIdNumber));

  // Load feed details from the database
  let conn, feed;
  try {
    conn = await openReaderDb();
    feed = await findFeedByIdInDb(conn, feedIdNumber);
  } catch(error) {
    console.warn(error);
    // TODO: visual feedback?
    return;
  } finally {
    IndexedDbUtils.close(conn);
  }

  const titleElement = document.getElementById('details-title');
  titleElement.textContent = feed.title || feed.link || 'Untitled';

  const faviconElement = document.getElementById('details-favicon');
  if(feed.faviconURLString) {
    faviconElement.setAttribute('src', feed.faviconURLString);
  } else {
    faviconElement.removeAttribute('src');
  }

  const descriptionElement = document.getElementById('details-feed-description');
  if(feed.description) {
    descriptionElement.textContent = feed.description;
  } else {
    descriptionElement.textContent = '';
  }

  const feedURLElement = document.getElementById('details-feed-url');
  feedURLElement.textContent = Feed.peekURL(feed);
  const feedLinkElement = document.getElementById('details-feed-link');
  feedLinkElement.textContent = feed.link || '';
  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.value = '' + feed.id;

  // TODO: show num entries, num unread/red, etc
  // TODO: show dateLastModified, datePublished, dateCreated, dateUpdated

  showSectionById('mi-feed-details');

  // Ensure the details are visible
  window.scrollTo(0,0);
}

async function subscribeFormOnsubmit(event) {
  event.preventDefault();

  const monitorElement = document.getElementById('submon');
  if(monitorElement) {
    console.debug('monitorElement.style.display: "%s"', monitorElement.style.display);
  }

  if(monitorElement && monitorElement.style.display === 'block') {
    console.debug('in progress, canceling submit');
    return false;
  }

  // TODO: rename, this is no longer query, simply a text input that should contain a url
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

  subscriptionMonitorShow();

  // This is safe because it is coming from the parsed url and not directly from user input, and
  // would have failed earlier.
  subscriptionMonitorAppendMessage(`Subscribing to ${url.href}`);

  // Note this uses create to create the feed object, and does not try to create a simple
  // object, to allow magic to happen
  const feed = Feed.create();

  Feed.appendURL(feed, url.href);

  let subscribedFeed;

  // TODO: show a visual error message in event of an error
  const subContext = new Subscriber.Context();
  subContext.fetchFeedTimeoutMs = 2000;

  // This is false by default but I want to clearly communicate intent. When false, subscribe will
  // poll the feed's entries as well.
  subContext.concurrent = false;

  try {
    await subContext.connect();
    subscribedFeed = await Subscriber.subscribe.call(subContext, feed);
  } catch(error) {
    console.warn(error);
    subscriptionMonitorHide();
    return;
  } finally {
    subContext.close();
  }

  assert(subscribedFeed);
  feedListAppendFeed(subscribedFeed);
  const feedURL = Feed.peekURL(subscribedFeed);

  // This is safe. feedURL comes from a string that has undergone deserialization into a URL object
  // and back to a string. Unsafe user input would have triggered a parsing error.
  subscriptionMonitorAppendMessage(`Subscribed to ${feedURL}`);
  subscriptionMonitorHide();
  showSectionById('subs-list-section');

  // Signal form should not be submitted
  return false;
}

async function feedListInit() {
  const noFeedsElement = document.getElementById('nosubs');
  const feedListElement = document.getElementById('feedlist');
  let conn, feeds;
  try {
    conn = await openReaderDb();
    feeds = await getFeedsFromDb(conn);
  } catch(error) {
    // TODO: react to error
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
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

  // Sorting in does in memory as opposed to leveraging the lexicographic order of an index on
  // the title property. The lexicographic order is not the desired order necessarily. Also, the
  // title index excludes feeds missing a title, which would be bad. The index on title that was
  // previously used was deprecated in switching to version 23 of the reader database.

  // Sort the feeds by title using indexedDB.cmp
  feeds.sort(function(a, b) {
    const atitle = a.title ? a.title.toLowerCase() : '';
    const btitle = b.title ? b.title.toLowerCase() : '';
    return indexedDB.cmp(atitle, btitle);
  });

  for(let feed of feeds) {
    feedListAppendFeed(feed);
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
function feedListRemoveFeed(feedId) {
  const feedElement = document.querySelector(
    `#feedlist li[feed="${feedId}"]`);

  assert(feedElement);

  feedElement.removeEventListener('click', feedListItemOnclick);
  feedElement.remove();

  // Upon removing the feed, update the displayed number of feeds.
  updateFeedCount();

  // Upon removing the feed, update the state of the feed list. If the feed list has no items,
  // hide it and show a message instead.
  const feedListElement = document.getElementById('feedlist');
  if(!feedListElement.childElementCount) {
    feedListElement.style.display = 'none';

    const noFeedsElement = document.getElementById('nosubs');
    noFeedsElement.style.display = 'block';
  }
}


// TODO: visually react to unsubscribe error
async function unsubscribeButtonOnclick(event) {
  const feedId = parseInt10(event.target.value);
  assert(Feed.isValidId(feedId));


  let conn;
  try {
    conn = await openReaderDb();
    await unsubscribe(feedId, conn, readerChannel);
  } catch(error) {
    console.warn(error);
    return;
  } finally {
    IndexedDbUtils.close(conn);
  }

  feedListRemoveFeed(feedId);
  showSectionById('subs-list-section');
}

function importOPMLButtonOnclick(event) {
  const uploaderInput = document.createElement('input');
  uploaderInput.setAttribute('type', 'file');
  uploaderInput.setAttribute('accept', MimeUtils.MIME_TYPE_XML);
  uploaderInput.onchange = importOPMLInputOnchange;
  uploaderInput.click();
}

async function importOPMLInputOnchange(event) {
  // TODO: show operation started

  const uploaderInput = event.target;

  const context = new ImportFilesContext();
  context.iconCache = new FaviconCache();
  context.fetchFeedTimeoutMs = 10 * 1000;

  try {
    await context.open();
    await importFiles.call(context, uploaderInput.files);
  } catch(error) {
    // TODO: visual feedback in event an error
    console.warn(error);
  } finally {
    context.close();
  }

  // TODO: show operation completed successfully
  // TODO: refresh feed list
  // TODO: switch to feed list section?
}

async function exportOPMLButtonOnclick(event) {
  const title = 'Subscriptions', fileName = 'subscriptions.xml';
  let conn;
  try {
    conn = await openReaderDb();
    const feeds = await getFeedsFromDb(conn);
    exportFeeds(feeds, title, fileName);
  } catch(error) {
    // TODO: handle error visually
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
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

function enableBgProcessingCheckboxOnclick(event) {
  if(event.target.checked) {
    requestBrowserPermission('background');
  } else {
    removeBrowserPermission('background');
  }
}

async function bgProcessingCheckboxInit() {
  const checkbox = document.getElementById('enable-background');
  assert(checkbox);

  // TODO: this should be using a local storage variable and instead the permission should be
  // permanently defined.

  checkbox.onclick = enableBgProcessingCheckboxOnclick;
  checkbox.checked = await hasBrowserPermission('background');
}

function restrictIdlePollingCheckboxOnclick(event) {
  if(event.target.checked) {
    localStorage.ONLY_POLL_IF_IDLE = '1';
  } else {
    delete localStorage.ONLY_POLL_IF_IDLE;
  }
}

function bgImageMenuOnchange(event) {
  const path = event.target.value;
  if(path) {
    localStorage.BG_IMAGE = path;
  } else {
    delete localStorage.BG_IMAGE;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function headerFontMenuOnchange(event){
  const font = event.target.value;
  if(font) {
    localStorage.HEADER_FONT_FAMILY = font;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function bodyFontMenuOnchange(event) {
  const font = event.target.value;
  if(font) {
    localStorage.BODY_FONT_FAMILY = font;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function columnCountMenuOnchange(event) {
  const count = event.target.value;
  if(count) {
    localStorage.COLUMN_COUNT = count;
  } else {
    delete localStorage.COLUMN_COUNT;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function entryBgColorInputOninput(event) {
  const color = event.target.value;
  if(color) {
    localStorage.BG_COLOR = color;
  } else {
    delete localStorage.BG_COLOR;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function entryMarginSliderOnchange(event) {
  const margin = event.target.value;
  console.log('entryMarginSliderOnchange new value', margin);

  if(margin) {
    localStorage.PADDING = margin;
  } else {
    delete localStorage.PADDING;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function headerFontSizeSliderOnchange(event) {
  const size = event.target.value;
  if(size) {
    localStorage.HEADER_FONT_SIZE = size;
  } else {
    delete localStorage.HEADER_FONT_SIZE;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function bodyFontSizeSliderOnchange(event) {
  const size = event.target.value;
  if(size) {
    localStorage.BODY_FONT_SIZE = size;
  } else {
    delete localStorage.BODY_FONT_SIZE;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function justifyTextCheckboxOnchange(event) {
  if(event.target.checked) {
    localStorage.JUSTIFY_TEXT = '1';
  } else {
    delete localStorage.JUSTIFY_TEXT;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}

function bodyHeightInputOninput(event) {
  const height = event.target.value;
  if(height) {
    localStorage.BODY_LINE_HEIGHT = height;
  } else {
    delete localStorage.BODY_LINE_HEIGHT;
  }

  readerChannel.postMessage({type: 'display-settings-changed'});
}



// Initialization

pageStyleSettingsOnload();

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

bgProcessingCheckboxInit();

const enableRestrictIdlePollingCheckbox = document.getElementById('enable-idle-check');
enableRestrictIdlePollingCheckbox.checked = 'ONLY_POLL_IF_IDLE' in localStorage;
enableRestrictIdlePollingCheckbox.onclick = restrictIdlePollingCheckboxOnclick;

const exportOPMLButton = document.getElementById('button-export-opml');
exportOPMLButton.onclick = exportOPMLButtonOnclick;
const importOPMLButton = document.getElementById('button-import-opml');
importOPMLButton.onclick = importOPMLButtonOnclick;

feedListInit();

// Init feed details section unsubscribe button click handler
const unsubscribeButton = document.getElementById('details-unsubscribe');
unsubscribeButton.onclick = unsubscribeButtonOnclick;

// Init the subscription form section
const subscriptionForm = document.getElementById('subscription-form');
subscriptionForm.onsubmit = subscribeFormOnsubmit;


// Init background image menu
{
  const backgroundImageMenu = document.getElementById('entry-background-image');
  backgroundImageMenu.onchange = bgImageMenuOnchange;
  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  backgroundImageMenu.appendChild(option);

  const currentBgImagePath = localStorage.BG_IMAGE;
  const bgImagePathOffset = '/images/'.length;
  for(const path of BG_IMAGES) {
    let option = document.createElement('option');
    option.value = path;
    option.textContent = path.substring(bgImagePathOffset);
    option.selected = currentBgImagePath === path;
    backgroundImageMenu.appendChild(option);
  }
}

{
  const headerFontMenu = document.getElementById('select-header-font');
  headerFontMenu.onchange = headerFontMenuOnchange;
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
  bodyFontMenu.onchange = bodyFontMenuOnchange;
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
  columnCountMenu.onchange = columnCountMenuOnchange;
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
if(localStorage.BG_COLOR) {
  bgColorInput.value = localStorage.BG_COLOR;
} else {
  bgColorInput.removeAttribute('value');
}
bgColorInput.oninput = entryBgColorInputOninput;

const marginInput = document.getElementById('entry-margin');
marginInput.value = localStorage.PADDING || '10';
marginInput.onchange = entryMarginSliderOnchange;

const headerFontSizeInput = document.getElementById('header-font-size');
headerFontSizeInput.value = localStorage.HEADER_FONT_SIZE || '1';
headerFontSizeInput.onchange = headerFontSizeSliderOnchange;

const bodyFontSizeInput = document.getElementById('body-font-size');
bodyFontSizeInput.value = localStorage.BODY_FONT_SIZE || '1';
bodyFontSizeInput.onchange = bodyFontSizeSliderOnchange;

const justifyTextCheckbox = document.getElementById('justify-text');
justifyTextCheckbox.checked = 'JUSTIFY_TEXT' in localStorage;
justifyTextCheckbox.onchange = justifyTextCheckboxOnchange;

const bodyLineHeightInput = document.getElementById('body-line-height');
bodyLineHeightInput.oninput = bodyHeightInputOninput;
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

showSectionById('subs-list-section');
