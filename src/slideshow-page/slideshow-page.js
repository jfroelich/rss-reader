import assert from "/src/common/assert.js";
import {escapeHTML, truncateHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";
import markEntryRead from "/src/feed-ops/mark-entry-read.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import {
  entryPeekURL,
  feedPeekURL,
  findViewableEntries,
  getFeeds,
  isEntry,
  isValidEntryId,
  open as openReaderDb
} from "/src/rdb.js";
import exportFeeds from "/src/slideshow-page/export-feeds.js";
import importOPMLFiles from "/src/slideshow-page/import-opml-files.js";
import * as PageStyle from "/src/slideshow-page/page-style-settings.js";
import * as Slideshow from "/src/slideshow-page/slideshow.js";


// TODO: need to handle on slide next now, it needs to be able to append slides, and it
// needs to be called so it can mark slide read and cleanup

const fonts = [
  'ArchivoNarrow-Regular',
  'Arial, sans-serif',
  'Calibri',
  'Cambria',
  'CartoGothicStd',
  'Fanwood',
  'Georgia',
  'League Mono Regular',
  'League Spartan',
  'Montserrat',
  'Noto Sans',
  'Open Sans Regular',
  'PathwayGothicOne',
  'PlayfairDisplaySC',
  'Roboto Regular'
];

const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  if(!event.isTrusted) {
    return;
  }

  const message = event.data;
  if(typeof message !== 'object' || message === null) {
    console.warn('Message event has missing or invalid message', event);
    return;
  }

  switch(message.type) {
  case 'display-settings-changed':
    PageStyle.pageStyleSettingsOnchange(message);
    break;
  case 'entry-added':
    onEntryAddedMessage(message).catch(console.warn);
    break;
  case 'entry-deleted':
    onEntryExpiredMessage(message).catch(console.warn);
    break;
  case 'entry-archived':
    onEntryExpiredMessage(message).catch(console.warn);
    break;
  case 'feed-deleted':
    console.warn('Unhandled feed-deleted message', message);
    break;
  case 'entry-marked-read':
    // TODO: call a mark read handler here that sets the slide element as read
    console.warn('Unhandled entry-marked-read message', message);
    break;
  case 'feed-added':
  case 'feed-activated':
  case 'feed-deactivated':
    console.debug('Ignoring message', message);
    break;
  default:
    console.warn('Unknown message type', message);
    break;
  }
};

channel.onmessageerror = function(event) {
  console.warn('Could not deserialize message from channel', event);
};

// Responds to the adding of an entry to the database from some background task. Conditionally
// appends new articles as slides.
async function onEntryAddedMessage(message) {
  // Do not append if several unread slides are still loaded
  const unreadSlideCount = countUnreadSlides();

  if(unreadSlideCount > 3) {
    return;
  }

  let conn;
  try {
    conn = await openReaderDb();
    await appendSlides(conn);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

function showErrorMessage(messageText) {
  const container = document.getElementById('error-message-container');

  // TODO: do not assert in UI
  assert(container instanceof Element, 'Cannot find error message container element to show error',
    messageText);
  container.textContent = messageText;
  container.style.display = 'block';
}

// React to a message indicating that an entry expired (e.g. it was deleted, or archived)
async function onEntryExpiredMessage(message) {

  // TODO: do not assert in UI

  // Caller is responsible for providing valid message. This should never happen.
  // TODO: use a stronger assertion of type
  assert(typeof message !== 'undefined');
  // Messages are a form of user-data, and can come from external sources outside of the app, and
  // therefore merit being distrusted. There could also be an error in how the message was created
  // or transfered (serialized, copied, and deserialized) by a channel. This should never happen
  // because I assume the dispatcher verified the trustworthiness of the message, and I assume that
  // the message poster formed a proper message.
  assert(isValidEntryId(message.id));

  // Search for a slide corresponding to the entry id. Assume the search never yields more than
  // one match.
  const slideElementName = Slideshow.getElementName();
  const slide = document.querySelector(slideElementName + '[entry="' + message.id + '"]');

  // There is no guarantee the entry id corresponds to a loaded slide. It is normal and frequent
  // for the slideshow to receive messages with entry ids that do not correspond to loaded slides.
  if(!slide) {
    console.debug('Corresponding slide for entry not loaded, ignoring message', message);
    return;
  }

  // The slide currently being viewed was externally modified such that it should no longer be
  // viewed, so we could prefer to remove it from the view. However, it is the current slide being
  // viewed which would lead to surprise as the article the user is reading is magically whisked
  // away. Instead, flag the slide as stale, so that other view functionality can react
  // appropriately at a later time in an unobtrusive manner.
  if(Slideshow.isCurrentSlide(slide)) {
    console.log('Cannot make current slide stale', message);
    slide.setAttribute('removed-after-load', 'true');
    return;
  }

  // The slide is not the current slide and is either already read and offscreen, or preloaded and
  // unread. In either case, remove the slide.
  Slideshow.remove(slide);

  // TODO: remove currently does not remove click listener, need to manually remove it here,
  // but i'd like to think of a better way
  slide.removeEventListener('click', onSlideClick);
}

function showLoadingInformation() {
  const loadingElement = document.getElementById('initial-loading-panel');
  if(loadingElement) {
    loadingElement.style.display = 'block';
  } else {
    console.error('Could not find initial loading panel');
  }
}

function hideLoadingInformation() {
  const loadingElement = document.getElementById('initial-loading-panel');
  if(loadingElement) {
    loadingElement.style.display = 'none';
  } else {
    console.error('Could not find initial loading panel');
  }
}


// TODO: as a result of introducing status I lost the non-blocking nature I was going for, so
// I need to rethink this.
// TODO: I don't think this needs the conn parameter?

async function markSlideRead(conn, slideElement) {

  // TODO: do not assert in the UI

  assert(slideElement instanceof Element);

  // Get the entry id for the slide
  const slideEntryAttributeValue = slideElement.getAttribute('entry');
  const entryId = parseInt(slideEntryAttributeValue, 10);
  // The entry id should always be valid or something is very wrong
  assert(isValidEntryId(entryId));

  console.log('Marking slide for entry %d as read', entryId);

  // Exit early if the slide has already been read. This is routine such as when navigating backward
  // and should not be considered an error.
  if(slideElement.hasAttribute('read')) {
    console.debug('Slide already marked as read', entryId);
    return Status.OK;
  }

  // TODO: rather than await, this should listen for entry-marked-read events roundtrip and
  // handle the event when it later occurs to mark the corresponding slide.
  // Then this can be called non-awaited.

  try {
    await markEntryRead(conn, channel, entryId);
  } catch(error) {
    // TODO: display an error
    console.error(error);
    return Status.EDB;
  }

  // Signal to the UI that the slide is read, so that unread counting works, and so that later
  // calls to this function exit prior to interacting with storage.
  slideElement.setAttribute('read', '');

  return Status.OK;
}

// TODO: append slides shouldn't be responsible for loading. This should accept an array
// of slides as input. Something else should be doing loading.
async function appendSlides(conn, limit) {
  console.log('Appending slides (limit: %d)', limit);

  limit = typeof limit === 'undefined' ? 3 : limit;
  const offset = countUnreadSlides();

  let entries;
  try {
    entries = await findViewableEntries(conn, offset, limit);
  } catch(error) {
    console.error(error);
    showErrorMessage('There was a problem loading articles from storage');
    return 0;
  }

  for(const entry of entries) {
    appendSlide(entry);
  }

  return entries.length;
}

// TODO: the creation of a slide element, and the appending of a slide element,
// should be two separate tasks. This will increase flexibility and maybe
// clarity. appendSlide should accept a slide element, not an entry.

// Given an entry, create a new slide element and append it to the view
function appendSlide(entry) {

  // TODO: do not assert in the UI
  assert(isEntry(entry));

  console.log('Creating and appending slide for entry', entry.id);
  const slide = Slideshow.create();
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class','entry');
  slide.addEventListener('click', onSlideClick);

  // An after-the-fact change to fix padding
  const slidePaddingWrapper = document.createElement('div');
  slidePaddingWrapper.className = 'slide-padding-wrapper';
  slidePaddingWrapper.appendChild(createArticleTitleElement(entry));
  slidePaddingWrapper.appendChild(createArticleContentElement(entry));
  slidePaddingWrapper.appendChild(createFeedSourceElement(entry));
  slide.appendChild(slidePaddingWrapper);

  Slideshow.append(slide);
}

function createArticleTitleElement(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', entryPeekURL(entry));
  titleElement.setAttribute('class', 'entry-title');
  titleElement.setAttribute('rel', 'noreferrer');

  if(entry.title) {
    let title = entry.title;
    let safeTitle = escapeHTML(title);

    // Set the attribute value to the full title without truncation or publisher filter
    // BUG: this is double encoding entities somehow, so entities show up in the value
    titleElement.setAttribute('title', safeTitle);

    let filteredSafeTitle = filterPublisher(safeTitle);
    try {
      filteredSafeTitle = truncateHTML(filteredSafeTitle, 300);
    } catch(error) {
      console.warn(error);
    }

    // Use innerHTML to allow entities in titles
    titleElement.innerHTML = filteredSafeTitle;

  } else {
    titleElement.setAttribute('title', 'Untitled');
    titleElement.textContent = 'Untitled';
  }

  return titleElement;
}

function createArticleContentElement(entry) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  contentElement.innerHTML = entry.content;
  return contentElement;
}

function createFeedSourceElement(entry) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class', 'entry-source');

  // At this point, assume that if faviconURLString is set, that it is
  // valid (defined, a string, a well-formed canonical url string). If it is not valid by this
  // point then something is really wrong elsewhere in the app, but that is not our concern here.
  // If the url is bad then show a broken image.
  if(entry.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }

  const details = document.createElement('span');
  if(entry.feedLink) {
    details.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.datePublished));
  }
  details.textContent = buffer.join('');
  sourceElement.appendChild(details);
  return sourceElement;
}

// TODO: create a utils.js file for slideshow-page and move this to that file

// TODO: support alternate whitespace expressions around delimiters
// Filter publisher information from an article title
// @param title {String} the title of an web page
// @returns {String} the title without publisher information
function filterPublisher(title) {
  assert(typeof title === 'string');
  // Look for a delimiter
  let delimiterPosition = title.lastIndexOf(' - ');
  if(delimiterPosition < 0) {
    delimiterPosition = title.lastIndexOf(' | ');
  }
  if(delimiterPosition < 0) {
    delimiterPosition = title.lastIndexOf(' : ');
  }

  // Exit early if no delimiter found
  if(delimiterPosition < 0) {
    return title;
  }

  // Exit early if the delimiter did not occur late enough in the title
  const MIN_TITLE_LENGTH = 20;
  if(delimiterPosition < MIN_TITLE_LENGTH) {
    return title;
  }

  // Exit early if the delimiter was found too close to the end
  const MIN_PUBLISHER_NAME_LENGTH = 5;
  const remainingCharCount = title.length - delimiterPosition;
  if(remainingCharCount < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  // Break apart the tail into words
  const delimiterLength = 3;
  const tail = title.substring(delimiterPosition + delimiterLength);
  const words = tokenize(tail);

  // If there are too many words, return the full title, because tail is probably not a publisher
  const MAX_TAIL_WORDS = 4;
  if(words.length > MAX_TAIL_WORDS) {
    return title;
  }

  // Return the modified title
  let outputTitle = title.substring(0, delimiterPosition);
  return outputTitle.trim();
}

// Helper for filterPublisher, break apart string into array of words
function tokenize(value) {
  if(typeof value === 'string') {
    // Avoid empty tokens by trimming and checking length
    const trimmedInput = value.trim();
    if(trimmedInput.length > 0) {
      return trimmedInput.split(/\s+/g);
    }
  }
  return [];
}

async function onSlideClick(event) {
  // We only care about responding to left click. Ignore all other buttons like right click and
  // mouse wheel.
  const CODE_LEFT_MOUSE_BUTTON = 1;
  if(event.which !== CODE_LEFT_MOUSE_BUTTON) {
    return true;
  }

  // Find the most immediate containing anchor. In theory there shouldn't be anchors nested in
  // anchors. Also note this can fail to find one (which is not an unexpected error).
  // event.target is the element that was clicked. This could be several things:
  // * a slide, clicked on misc area of a slide
  // * an anchor in a slide
  // * an element within an anchor, like a clickable image
  const anchor = event.target.closest('a');

  // Ignore non-anchor-involved clicks, leave the click as is and defer click handling to
  // browser.
  if(!anchor) {
    return true;
  }

  // Technically this should never happen, right? Because all such anchors should have been
  // removed by the content-filters in document preprocessing. Therefore, log a warning
  // message and exit.
  // TODO: should this be a visual error?
  if(!anchor.hasAttribute('href')) {
    console.warn('Clicked anchor that should have been filtered by preprocessing',
      anchor.outerHTML);
    return true;
  }

  // We've determined at this point we are going to handle the click. Inform the browser that we
  // are intercepting.
  event.preventDefault();

  // Get the url and open the url in a new tab.
  const urlString = anchor.getAttribute('href');
  if(!urlString) {
    console.error(
      'An invalid url somehow got through data processing to the ui, should never happen',
      anchor.outerHTML);
    return;
  }

  openTab(urlString);

  // After opening the link in a new tab, then continue processing. Next, find the slide that was
  // clicked. This is typically the current slide, but that isn't guaranteed. Article elements are
  // filtered from document content, so the only time an ancestor of the anchor is an article is
  // when it is the slide that contains the anchor.
  // Start from parent node to skip the closest test against the anchor itself.
  const clickedSlide = anchor.parentNode.closest('slide');

  // Throw an assertion error if we didn't find the containing slide.
  // TODO: don't assert at the UI level. Do something like show a human-friendly error message and
  // exit early. But maybe this shouldn't be a visible error and bad behavior should happen?
  assert(clickedSlide instanceof Element);

  // Weak sanity check that the element is a slide, mostly just to monitor the recent changes to
  // this function.
  const currentSlide = Slideshow.getCurrentSlide();
  if(clickedSlide !== currentSlide) {
    console.log('Clicked slide is different than current slide', clickedSlide, currentSlide);
  }

  // Although this condition is primarily a concern of markSlideRead, and is redundant with
  // the check that occurs within markSlideRead, checking it here avoids the call.
  if(clickedSlide.hasAttribute('removed-after-load')) {
    console.log('Exiting click handler early due to stale state', clickedSlide);
    return false;
  }

  // Mark the current slide as read
  let conn;
  try {
    conn = await openReaderDb();
  } catch(error) {
    // TODO: visually show error
    console.error(error);
    return false;
  }

  let status = await markSlideRead(conn, clickedSlide);
  if(status !== Status.OK) {
    // TODO: visually show error
    console.error('Failed to mark slide as read', Status.toString(status));
    conn.close();
    return;
  }

  conn.close();

  // Still signal the click should not default to normal click behavior, the browser should not
  // react to the click on its own. Even though I already called preventDefault.
  // TODO: if a function does not explicitly return it returns undefined. Does the browser only
  // cancel if exactly false or is returning undefined the same? If returning undefined is the
  // same then this return statement is implicit and not necessary.
  return false;
}



// TODO: is the debouncing stuff with idle callback approach needed??
// TODO: do not handle key press if target is input/textarea
let keydownTimerId = null;
function onKeyDown(event) {
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  switch(code) {
  case RIGHT:
  case N:
  case SPACE: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(nextSlide);
    break;
  }

  case LEFT:
  case P: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(Slideshow.prev);
    break;
  }
  }
}

window.addEventListener('keydown', onKeyDown);




// TODO: I should probably unlink loading on demand and navigation, because this causes
// lag.
// navigation would be smoother if I appended even earlier, like before even reaching the
// situation of its the last slide and there are no more so append. It would be better if I did
// something like check the number of remaining unread slides, and if that is less than some
// number, append more. And it would be better if I did that before even navigating. However that
// would cause lag. So it would be even better if I started in a separate microtask an append
// operation and then continued in the current task. Or, the check should happen not on append,
// but after doing the navigation. Or after marking the slide as read.

// TODO: sharing the connection between mark as read and appendSlides made sense at first but I
// do not like the large try/catch block. Also I think the two can be unlinked because they do not
// have to co-occur. Also I don't like how it has to wait for read to complete.



async function nextSlide() {

  const currentSlide = Slideshow.getCurrentSlide();

  // If there are still unread articles return. Do not mark the current article, if it exists,
  // as read.
  const unreadSlideCount = countUnreadSlides();
  // We still append if there is just one unread slide
  if(unreadSlideCount > 1) {
    console.debug('Not dynamically appending because %d unread slides remain', unreadSlideCount);


    // Mark the current slide as read
    let conn;
    try {
      conn = await openReaderDb();
    } catch(error) {
      console.error(error);
      return;
    }

    let status = await markSlideRead(conn, currentSlide);
    if(status !== Status.OK) {
      // TODO: show an error message
      console.error('Failed to mark slide as read', Status.toString(status));
      conn.close();
      return;
    }

    conn.close();

    Slideshow.next();
    return;
  }

  let appendCount = 0;
  let conn;
  try {
    conn = await openReaderDb();
  } catch(error) {
    console.error(error);
    return;
  }


  if(unreadSlideCount < 2) {
    console.log('Appending additional slides prior to navigation');
    appendCount = await appendSlides(conn);
  } else {
    console.log('Not appending additional slides prior to navigation');
  }

  Slideshow.next();

  let status = await markSlideRead(conn, currentSlide);
  if(status !== Status.OK) {
    // TODO: show an error message
    console.error('Failed to mark slide as read', Status.toString(status));
    conn.close();
    return;
  }

  conn.close();

  if(appendCount < 1) {
    return;
  }

  const maxLoadCount = 6;
  let firstSlide = Slideshow.getFirstSlide();
  while(Slideshow.count() > maxLoadCount && firstSlide !== currentSlide) {
    Slideshow.remove(firstSlide);
    firstSlide.removeEventListener('click', onSlideClick);
    firstSlide = Slideshow.getFirstSlide();
  }
}


function countUnreadSlides() {
  const slides = Slideshow.getSlides();
  let count = 0;
  for(const slide of slides) {
    if(slide.hasAttribute('read')) {
      continue;
    }
    count++;
  }
  return count;
}


let refreshInProgress = false;
async function refreshAnchorOnclick(event) {
  event.preventDefault();
  console.log('Clicked refresh button');

  if(refreshInProgress) {
    console.log('Ignoring refresh button click while refresh in progress');
    return;
  }
  refreshInProgress = true;

  const poll = new FeedPoll();
  poll.init();
  poll.ignoreRecencyCheck = true;
  poll.ignoreModifiedCheck = true;

  try {
    await poll.open();
    await poll.pollFeeds();
  } catch(error) {
    // TODO: show an error message
    console.debug(error);
  } finally {
    poll.close();
    console.log('Re-enabling refresh button');
    refreshInProgress = false;// Always renable
  }
}

function showMenuOptions() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '0px';
  menuOptions.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

function hideMenuOptions() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '-320px';
  menuOptions.style.boxShadow = '';// HACK
}

function mainMenuButtonOnclick(event) {
  const menuOptions = document.getElementById('left-panel');
  if(menuOptions.style.marginLeft === '0px') {
    hideMenuOptions();
  } else if(menuOptions.style.marginLeft === '') {
    showMenuOptions();
  } else {
    showMenuOptions();
  }
}

function menuOptionsOnclick(event) {
  // event.target points to either a clicked <li> or the <ul>
  const option = event.target;
  if(option.localName !== 'li') {
    console.debug('Ignoring click on menu options that is not on menu item');
    return;
  }

  switch(option.id) {
  case 'menu-option-subscribe':
    console.warn('Not yet implemented');
    break;
  case 'menu-option-import':
    menuOptionImportOnclick();
    break;
  case 'menu-option-export':
    menuOptionExportOnclick();
    break;
  case 'menu-option-header-font':
    // Ignore, this has its own handler
    break;
  case 'menu-option-body-font':
    // Ignore
    break;
  default:
    console.debug('Unhandled menu option click', option.id);
    break;
  }
}

function menuOptionImportOnclick() {
  const uploaderInput = document.createElement('input');
  uploaderInput.setAttribute('type', 'file');
  uploaderInput.setAttribute('accept', 'text/xml');
  uploaderInput.onchange = function importInputOnchange(event) {
    importFiles(uploaderInput.files).catch(console.warn);
  };
  uploaderInput.click();
}

async function importFiles(files) {

  // For the import, use the slideshow page's persistent channel
  // Given that there could be several feeds being subscribed, use a slightly
  // higher timeout than average to reduce the chance that some contention delays
  // result in failure
  const importContext = {
    channel: channel,
    fetchFeedTimeout: 10 * 1000
  };

  // TODO: show operation started

  let status = await importOPMLFiles(importContext, files);
  if(status !== Status.OK) {
    // TODO: visual feedback in event an error
    console.error('Failed to import opml files', Status.toString(status));
    return;
  }

  console.log('Import completed');

  // TODO: visually inform the user that the operation completed successfully
  // TODO: refresh feed list
  // TODO: check for new articles?
  // TODO: switch to feed list section?
}

async function menuOptionExportOnclick() {
  const title = 'Subscriptions';
  const fileName = 'subscriptions.xml';
  let conn, feeds;
  try {
    feeds = await getFeeds(conn);
    exportFeeds(feeds, title, fileName);
  } catch(error) {
    // TODO: show an error message
    console.error(error);
    return;
  }

  // TODO: visual feedback on completion
  console.log('Completed export');
}

function errorMessageContainerOnclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}

function noop() {}

function windowOnclick(event) {

  // TODO: am I still using marginLeft? I thought I switched to left?

  // If the click occurred outside of the menu options panel, hide the menu options panel
  const avoidedZoneIds = ['main-menu-button', 'left-panel'];
  if(!avoidedZoneIds.includes(event.target.id) && !event.target.closest('[id="left-panel"]')) {
    // Hide only if not hidden. marginLeft is only 0px in visible state. If marginLeft is
    // empty string or -320px then menu already hidden
    const aside = document.getElementById('left-panel');
    if(aside.style.marginLeft === '0px') {
      hideMenuOptions();
    }
  }

  return true;
}

function feedsContainerOnclick(event) {
  if(event.target.localName !== 'div') {
    return true;
  }

  if(!event.target.id) {
    return true;
  }

  toggleFeedContainerDetails(event.target);
}

function toggleFeedContainerDetails(feedElement) {

  const table = feedElement.querySelector('table');

  if(feedElement.hasAttribute('expanded')) {
    // Collapse
    feedElement.removeAttribute('expanded');
    feedElement.style.width = '200px';
    feedElement.style.height = '200px';
    feedElement.style.cursor = 'zoom-in';
    table.style.display = 'none';
  } else {
    // Expand
    feedElement.setAttribute('expanded', 'true');
    feedElement.style.width = '100%';
    feedElement.style.height = 'auto';
    feedElement.style.cursor = 'zoom-out';
    table.style.display = 'block';
  }
}

function feedsButtonOnclick(event) {
  const feedsButton = document.getElementById('feeds-button');
  feedsButton.disabled = true;
  const readerButton = document.getElementById('reader-button');
  readerButton.disabled = false;
  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.style.display = 'none';
  const feedsContainer = document.getElementById('feeds-container');
  feedsContainer.style.display = 'block';
}

function readerButtonOnclick(event) {
  const feedsButton = document.getElementById('feeds-button');
  feedsButton.disabled = false;
  const readerButton = document.getElementById('reader-button');
  readerButton.disabled = true;
  const slidesContainer = document.getElementById('slideshow-container');
  slidesContainer.style.display = 'block';
  const feedsContainer = document.getElementById('feeds-container');
  feedsContainer.style.display = 'none';
}

function initFeedsContainer(feeds) {
  for(const feed of feeds) {
    appendFeed(feed);
  }
}

function unsubscribeButtonOnclick(event) {
  console.debug('Unsubscribe', event.target);
}

// TODO: create helper function createFeedElement that then is passed to this, rename this to
// appendFeedElement and change its parameter
function appendFeed(feed) {

  const feedsContainer = document.getElementById('feeds-container');
  const feedElement = document.createElement('div');
  feedElement.id = feed.id;

  if(feed.active !== true) {
    feedElement.setAttribute('inactive', 'true');
  }

  let titleElement = document.createElement('span');
  titleElement.textContent = feed.title;
  feedElement.appendChild(titleElement);

  const feedInfoElement = document.createElement('table');

  let row = document.createElement('tr');
  let col = document.createElement('td');
  col.textContent = 'Description';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.description || 'No description';
  row.appendChild(col);
  feedInfoElement.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Webpage';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.link || 'Not specified';
  row.appendChild(col);
  feedInfoElement.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Favicon';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.faviconURLString || 'Unknown';
  row.appendChild(col);
  feedInfoElement.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'URL';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feedPeekURL(feed);
  row.appendChild(col);
  feedInfoElement.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.setAttribute('colspan', '2');

  let button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribeButtonOnclick;
  button.textContent = 'Unsubscribe';
  col.appendChild(button);

  button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribeButtonOnclick;
  button.textContent = 'Activate';
  if(feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);

  button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribeButtonOnclick;
  button.textContent = 'Deactivate';
  if(!feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);


  row.appendChild(col);
  feedInfoElement.appendChild(row);

  feedElement.appendChild(feedInfoElement);

  if(feedsContainer) {
    feedsContainer.appendChild(feedElement);
  }
}

function formatDate(date, delimiter) {
  if(!(date instanceof Date)) {
    return 'Invalid date';
  }

  // TODO: date can literally contain "Invalid Date" somehow
  // Like, "Invalid Date" is actually an instance of date.
  // No idea. But a couple of things. First is to handle it here
  // using try/catch to prevent failure. Second is to figure out
  // where the bad date comes from. I should never be storing such
  // a date, it should have been caught earlier in the pipeline.
  // It came from http://www.lispcast.com/feed, the entry
  // http://groups.google.com/group/ring-clojure/browse_thread/thread/f18338ffda7e38f5

  // new Date('Tue 13 Dec 2011 09:37:46 AM ART') =>
  // "Invalid Date".
  // So, date parsing is not working, like it just fails
  // How to detect "Invalid Date"?
  // https://stackoverflow.com/questions/1353684
  // Date.parse('Tue 13 Dec 2011 09:37:46 AM ART') => NaN

  // var d = new Date('Tue 13 Dec 2011 09:37:46 AM ART'); d.getTime() === d.getTime(); => false
  // So basically all the date parsing needs to be refactored. Not sure I even need the
  // try/catches.

/*
function parseDate(string) {
  const date = new Date(string);
  if(date.getTime() !== date.getTime()) {
    throw new Error('Date parsing error for value ' + string);
  }
  return date;
}
*/

  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/
  // Reference/Global_Objects/DateTimeFormat
  const formatter = new Intl.DateTimeFormat();
  try {
    return formatter.format(date);
  } catch(error) {
    console.debug(error);
    return 'Invalid date';
  }
}

function openTab(url) {
  chrome.tabs.create({active: true, url: url});
}

function headerFontMenuOnchange(event) {
  console.debug('Header font menu change event', event);
  const fontName = event.target.value;
  if(fontName) {
    localStorage.HEADER_FONT_FAMILY = fontName;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  PageStyle.pageStyleSettingsOnchange();
}

function bodyFontMenuOnchange(event) {
  console.debug('Body font menu change event', event);
  const fontName = event.target.value;
  if(fontName) {
    localStorage.BODY_FONT_FAMILY = fontName;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  PageStyle.pageStyleSettingsOnchange();
}

function initHeaderFontMenu() {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = headerFontMenuOnchange;
  const currentHeaderFont = localStorage.HEADER_FONT_FAMILY;
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Header Font';
  menu.appendChild(defaultOption);
  for(const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if(fontName === currentHeaderFont) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

function initBodyFontMenu() {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = bodyFontMenuOnchange;
  const currentBodyFont = localStorage.BODY_FONT_FAMILY;
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Body Font';
  menu.appendChild(defaultOption);
  for(const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if(fontName === currentBodyFont) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

async function initSlideshowPage() {

  showLoadingInformation();

  window.addEventListener('click', windowOnclick);

  const mainMenuButton = document.getElementById('main-menu-button');
  mainMenuButton.onclick = mainMenuButtonOnclick;

  // Initialize the refresh icon in the header
  const refreshButton = document.getElementById('refresh');
  refreshButton.onclick = refreshAnchorOnclick;

  const feedsButton = document.getElementById('feeds-button');
  feedsButton.onclick = feedsButtonOnclick;

  const readerButton = document.getElementById('reader-button');
  readerButton.onclick = readerButtonOnclick;

  // Initialize error message container
  const errorContainer = document.getElementById('error-message-container');
  if(errorContainer) {
    errorContainer.onclick = errorMessageContainerOnclick;
  }

  const feedsContainer = document.getElementById('feeds-container');
  if(feedsContainer) {
    feedsContainer.onclick = feedsContainerOnclick;
  }

  const menuOptions = document.getElementById('left-panel');
  menuOptions.onclick = menuOptionsOnclick;

  initHeaderFontMenu();
  initBodyFontMenu();

  // TODO: is it possible to defer this until after loading without slowing things down?
  // Initialize entry display settings
  PageStyle.pageStyleSettingsOnload();

  // TODO: closing should happen before append actually takes place, there is no need to keep
  // the database open longer.
  // TODO: create a helper function that encapsulates this

  // Load and append slides


  const initialLimit = 1;
  let didHideLoading = false;

  let conn;
  try {
    conn = await openReaderDb();
  } catch(error) {
    // TODO: visually show error message
    console.error(error);
    hideLoadingInformation();
    return;
  }

  // TODO: change appendSlides to return status and check it here
  // First load only 1, to load quickly
  await appendSlides(conn, initialLimit);
  console.log('Initial slide loaded');

  hideLoadingInformation();

  // TODO: change appendSlides to return status and check it here
  // Now preload a couple more
  await appendSlides(conn, 2);

  let feeds;
  try {
    feeds = await getFeeds(conn);
  } catch(error) {
    // TODO: show an error message
    console.error(error);
    conn.close();
    return;
  }

  conn.close();

  feeds.sort(function compareFeedTitle(a, b) {
    const atitle = a.title ? a.title.toLowerCase() : '';
    const btitle = b.title ? b.title.toLowerCase() : '';
    return indexedDB.cmp(atitle, btitle);
  });

  initFeedsContainer(feeds);
}

// TODO: visually show error
initSlideshowPage().catch(console.warn);
