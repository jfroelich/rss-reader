import assert from "/src/assert/assert.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeeds from "/src/jobs/poll/poll-feeds.js";
import * as Entry from "/src/reader-db/entry.js";
import {
  pageStyleSettingsOnload,
  pageStyleSettingsOnchange
} from "/src/page-style/page-style-settings.js";
import {openTab} from "/src/platform/platform.js";
import escapeHTML from "/src/html/escape.js";
import htmlTruncate from "/src/html/truncate.js";
import openReaderDb from "/src/reader-db/open.js";
import entryMarkRead from "/src/reader-db/entry-mark-read.js";
import findViewableEntriesInDb from "/src/reader-db/find-viewable-entries.js";
import {isCanonicalURLString} from "/src/url/url-string.js";
import formatDate from "/src/utils/format-date.js";
import filterPublisher from "/src/utils/filter-publisher.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import parseInt10 from "/src/utils/parse-int-10.js";

// TODO: set magic on message objects, write a helper somewhere named something like
// isReaderMessage(message) that checks against the magic property. This should wait until I
// define some helper kind of module like 'channel-coordinator.js' that organizes all of this.
// TODO: this should come from somewhere else
const CHANNEL_NAME = 'reader';

// Track the currently visible slide
let currentSlide;

// Define a channel that remains open for the lifetime of the slideshow page. It will listen to
// events coming in from other pages, or the page itself, and react to them. Ordinarily a channel
// should not remain open indefinitely but here it makes sense.
const readerChannel = new BroadcastChannel(CHANNEL_NAME);
readerChannel.onmessage = function(event) {
  if(!(event instanceof MessageEvent)) {
    return;
  }

  if(!event.isTrusted) {
    console.debug('Untrusted message event', event);
    return;
  }

  const message = event.data;
  if(typeof message !== 'object' || message === null) {
    console.warn('Message event has missing or invalid message', event);
    return false;
  }

  switch(message.type) {
  case 'display-settings-changed':
    pageStyleSettingsOnchange(message);
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
  default:
    console.warn('Unknown message type', message);
    break;
  }
};

readerChannel.onmessageerror = function(event) {
  console.warn('Could not deserialize message from channel', event);
};

// Responds to the adding of an entry to the database from some background task. Conditionally
// appends new articles as slides.
async function onEntryAddedMessage(message) {
  // Do not append if several unread slides are still loaded
  const unreadSlideCount = countUnreadSlides();

  if(unreadSlideCount > 3) {
    console.debug('Got an entry added message but not appending because too many slides');
    return;
  }

  console.debug('Calling appendSlides as a result of entry-added message');

  // Load new articles
  let conn;
  try {
    conn = await openReaderDb();
    await appendSlides(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
  }
}

function showErrorMessage(messageText) {
  const container = document.getElementById('error-message-container');
  assert(container, 'Cannot find error message container element to show error', messageText);
  container.textContent = messageText;
  container.style.display = 'block';
}

// React to a message indicating that an entry expired (e.g. it was deleted, or archived)
async function onEntryExpiredMessage(message) {
  // Caller is responsible for providing valid message. This should never happen.
  assert(message);
  // Messages are a form of user-data, and can come from external sources outside of the app, and
  // therefore merit being distrusted. There could also be an error in how the message was created
  // or transfered (serialized, copied, and deserialized) by a channel. This should never happen
  // because I assume the dispatcher verified the trustworthiness of the message, and I assume that
  // the message poster formed a proper message.
  assert(Entry.isValidId(message.id));

  // Search for a slide corresponding to the entry id. Assume the search never yields more than
  // one match.
  const slide = document.querySelector('article[entry="' + message.id + '"]');

  // There is no guarantee the entry id corresponds to a loaded slide. It is normal and frequent
  // for the slideshow to receive messages with entry ids that do not correspond to loaded slides.
  if(!slide) {
    return;
  }

  // The slide currently being viewed was externally modified such that it should no longer be
  // viewed, so we could prefer to remove it from the view. However, it is the current slide being
  // viewed which would lead to surprise as the article the user is reading is magically whisked
  // away. Instead, flag the slide as stale, so that other view functionality can react
  // appropriately at a later time in an unobtrusive manner.
  if(slide === currentSlide) {
    // console.debug('Cannot expire current slide', message);
    slide.setAttribute('removed-after-load', '');
    return;
  }

  // The slide is not the current slide and is either already read and offscreen, or preloaded and
  // unread. In either case, remove the slide.
  removeSlide(slide);

  // TODO: if we are removing a slide, should this then also refill?
}

function showLoadingInformation() {
  const loadingElement = document.getElementById('initial-loading-panel');
  assert(loadingElement);
  loadingElement.style.display = 'block';
}

function hideLoadingInformation() {
  const loadingElement = document.getElementById('initial-loading-panel');
  assert(loadingElement);
  loadingElement.style.display = 'none';
}

function removeSlide(slideElement) {
  assert(slideElement instanceof Element);
  slideElement.removeEventListener('click', onSlideClick);
  slideElement.remove();
}

async function markSlideRead(conn, slideElement) {
  assert(IndexedDbUtils.isOpen(conn));

  // Get the entry id for the slide
  const slideEntryAttributeValue = slideElement.getAttribute('entry');
  const entryId = parseInt10(slideEntryAttributeValue);
  // The entry id should always be valid or something is very wrong
  assert(Entry.isValidId(entryId));

  // Immediately check if the slide should be ignored. One reason is that it was externally
  // made unviewable by some other background process like unsubscribe or archive after the slide
  // was loaded into view, but at the time it was made unviewable it was not unloadable from the
  // view.
  if(slideElement.hasAttribute('removed-after-load')) {
    console.debug('canceling mark as read given that slide removed after load', entryId);
    return;
  }

  // Exit early if the slide has already been read. This is routine such as when navigating backward
  // and should not be considered an error.
  if(slideElement.hasAttribute('read')) {
    console.debug('canceling mark as read as slide already marked', entryId);
    return;
  }

  // Update storage. Handle any error in an opaque manner.
  try {
    await entryMarkRead(conn, entryId);
  } catch(error) {
    console.warn(error);
    // Fall through and mark the element as read anyway, to prevent the error that appears later
    // when trying to mark as red.
    console.debug('slide may not be updated as read in db but designating as read in UI',
      slideElement);
  }

  // Signal to the UI that the slide is read, so that unread counting works, and so that later
  // calls to this function exit prior to interacting with storage.
  slideElement.setAttribute('read', '');
}

async function appendSlides(conn) {

  console.debug('Appending up to 3 new slides');

  const limit = 3;
  let entries = [];
  const offset = countUnreadSlides();

  try {
    entries = await findViewableEntriesInDb(conn, offset, limit);
  } catch(error) {
    console.warn(error);
    showErrorMessage(
      'There was a problem loading articles from storage, try refreshing or reinstalling');
    return 0;
  }

  for(const entry of entries) {
    appendSlide(entry);
  }

  return entries.length;
}

// Given an entry, create a new slide element and append it to the view
function appendSlide(entry) {
  assert(Entry.isEntry(entry));

  console.debug('Creating and appending slide for entry', entry.id);

  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('article');

  // tabindex must be explicitly defined for the element to receive focus
  slideElement.setAttribute('tabindex', '-1');
  slideElement.setAttribute('entry', entry.id);
  slideElement.setAttribute('feed', entry.feed);
  slideElement.setAttribute('class','entry');
  slideElement.addEventListener('click', onSlideClick);
  // Bind to slide, not window, because only slide scrolls
  // TODO: look into the new 'passive' flag for scroll listeners
  slideElement.addEventListener('scroll', onSlideScroll);
  slideElement.style.position = 'absolute';

  if(containerElement.childElementCount) {
    slideElement.style.left = '100%';
    slideElement.style.right = '-100%';
  } else {
    slideElement.style.left = '0%';
    slideElement.style.right = '0%';
  }

  slideElement.style.overflowX = 'hidden';
  slideElement.style.top = '0';
  slideElement.style.bottom = '0';
  slideElement.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const titleElement = createArticleTitleElement(entry);
  slideElement.appendChild(titleElement);
  const contentElement = createArticleContentElement(entry);
  slideElement.appendChild(contentElement);
  const sourceElement = createFeedSourceElement(entry);
  slideElement.appendChild(sourceElement);

  containerElement.appendChild(slideElement);

  // If this was the only slide appended, or the first slide appended in a series of append calls,
  // ensure that currentSlide is set, and focus the slide.
  if(containerElement.childElementCount === 1) {
    currentSlide = slideElement;
    currentSlide.focus();
  }
}

function createArticleTitleElement(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', Entry.peekURL(entry));
  titleElement.setAttribute('class', 'entry-title');

  // TODO: use of _blank is discouraged. Need to use custom listener that opens new tab instead
  // titleElement.setAttribute('target','_blank');

  titleElement.setAttribute('rel', 'noreferrer');

  if(entry.title) {
    let title = entry.title;
    let safeTitle = escapeHTML(title);

    // Set the attribute value to the full title without truncation or publisher filter
    // BUG: this is double encoding entities somehow, so entities show up in the value
    titleElement.setAttribute('title', safeTitle);

    let filteredSafeTitle = filterPublisher(safeTitle);
    try {
      filteredSafeTitle = htmlTruncate(filteredSafeTitle, 300);
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

  if(entry.faviconURLString) {
    assert(isCanonicalURLString(entry.faviconURLString));
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }
  // TODO: why is this called title? This should be renamed to something like attributionElement
  const titleElement = document.createElement('span');
  if(entry.feedLink) {
    titleElement.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.datePublished));
  }
  titleElement.textContent = buffer.join('');
  sourceElement.appendChild(titleElement);
  return sourceElement;
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
  // If this assertion fails something has gone really wrong
  // Also protect against opening of relative url where chrome-extension:// gets substituted in
  assert(isCanonicalURLString(urlString));
  openTab(urlString);

  // After opening the link in a new tab, then continue processing. Next, find the slide that was
  // clicked. This is typically the current slide, but that isn't guaranteed. Article elements are
  // filtered from document content, so the only time an ancestor of the anchor is an article is
  // when it is the slide that contains the anchor.
  // Start from parent node to skip the closest test against the anchor itself.
  const clickedSlide = anchor.parentNode.closest('article');

  // Throw an assertion error if we didn't find the containing slide.
  // TODO: don't assert at the UI level. Do something like show a human-friendly error message and
  // exit early. But maybe this shouldn't be a visible error and bad behavior should happen?
  assert(clickedSlide instanceof Element);

  // Weak sanity check that the element is a slide, mostly just to monitor the recent changes to
  // this function.
  if(clickedSlide !== currentSlide) {
    console.debug('Clicked slide is different than current slide', clickedSlide, currentSlide);
  }

  // Although this condition is primarily a concern of markSlideRead, and is redundant with
  // the check that occurs within markSlideRead, checking it here avoids the call.
  if(clickedSlide.hasAttribute('removed-after-load')) {
    console.debug('Exiting click handler early due to stale state', clickedSlide);
    return false;
  }

  // Mark the current slide as read
  let conn;
  try {
    conn = await openReaderDb();
    await markSlideRead(conn, clickedSlide);
  } catch(error) {
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
  }

  // Still signal the click should not default to normal click behavior, the browser should not
  // react to the click on its own. Even though I already called preventDefault.
  // TODO: if a function does not explicitly return it returns undefined. Does the browser only
  // cancel if exactly false or is returning undefined the same? If returning undefined is the
  // same then this return statement is implicit and not necessary.
  return false;
}

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

// TODO: visual feedback on error
async function showNextSlide() {

  // currentSlide may be undefined when no entries are loaded. This isn't an error.
  if(!currentSlide) {
    return;
  }

  const oldSlideElement = currentSlide;
  let slideAppendCount = 0;
  let conn;
  try {
    conn = await openReaderDb();

    // NOTE: this must occur before searching for next slide, otherwise it will not load on demand

    // Conditionally append more slides
    const unreadSlideElementCount = countUnreadSlides();
    console.debug('Detected %d unread slides when deciding whether to append on navigate',
      unreadSlideElementCount);
    if(unreadSlideElementCount < 2) {
      console.debug('Appending additional slides prior to navigation');
      slideAppendCount = await appendSlides(conn);
    } else {
      console.debug('Not appending additional slides prior to navigation');
    }

    // Search for the next slide to show. The next slide is not necessarily adjacent.
    // TODO: cleanup the iteration logic once it becomes clearer to me.
    let nextSlide;
    let slideCursor = currentSlide;
    while(true) {
      slideCursor = slideCursor.nextElementSibling;
      if(slideCursor) {
        if(slideCursor.hasAttribute('removed-after-load')) {
          // Skip past the slide
          console.debug('Skipping slide removed after load when searching for next slide');
          continue;
        } else {
          console.debug('Found next slide');
          // Found next sibling, end search
          nextSlide = slideCursor;
          break;
        }
      } else {
        // BUG: some portions of the bug have been fixed, but there is still a bug where this
        // gets hit after unsubscribe. The current slide is indeed the final slide, no additional
        // slides were loaded. It means that something is wrong with the appending.
        console.debug(currentSlide);
        console.debug('Ending search for next slide, no next sibling');
        // If we advanced and there was no next sibling, leave nextSlide undefined and end search
        break;
      }
    }


    if(nextSlide) {
      currentSlide.style.left = '-100%';
      currentSlide.style.right = '100%';
      nextSlide.style.left = '0px';
      nextSlide.style.right = '0px';
      currentSlide.scrollTop = 0;
      currentSlide = nextSlide;

      // Change the active element to the new current slide, so that scrolling with keys works
      currentSlide.focus();

      // Only mark the slide as read if navigation occurs, which only occurs if there was a next
      // slide
      await markSlideRead(conn, oldSlideElement);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
  }

  // If more slides were appended, then reduce the number of slides loaded. This works from left
  // to right, or in document order basically, because earlier slides were appended earlier.
  // TODO: should this do a scan of slides that are marked 'removed-after-load' at this time and
  // try and remove any of them, regardless of max slide count or min slide count or whatever? And
  // regardless of whether slides were appended?

  if(slideAppendCount > 0) {
    assert(currentSlide);
    const maxSlideCount = 6;
    const containerElement = document.getElementById('slideshow-container');
    while(containerElement.childElementCount > maxSlideCount &&
      containerElement.firstElementChild !== currentSlide) {
      console.debug('Removing slide with with entry id',
        containerElement.firstElementChild.getAttribute('entry'));
      removeSlide(containerElement.firstElementChild);
    }
  }
}

// Move the current slide out of view to the right, and move the previous slide into view, and then
// update the current slide.
function showPreviousSlide() {

  // There may not be a current slide when no slides are loaded
  if(!currentSlide) {
    return;
  }

  // TODO: refactor this function to account for removed-after-load characteristic. I am going to
  // wait to do this until I update showNextSlide
  // Question is whether i want to allow navigation back to a slide that was removed after load
  // while it happens to still be loaded. Otherwise user clicks back and slide is mysteriously
  // missing. but how different is that from the way slides eventually do get unloaded?

  const prevSlideElement = currentSlide.previousSibling;
  if(!prevSlideElement) {
    return;
  }

  currentSlide.style.left = '100%';
  currentSlide.style.right = '-100%';
  prevSlideElement.style.left = '0';
  prevSlideElement.style.right = '0';
  currentSlide = prevSlideElement;
  // Change the active element to the new current slide, so that scrolling using keyboard keys still
  // works
  currentSlide.focus();
}

function countUnreadSlides() {

  // TODO: change this to also exclude removed-after-load slides from the count?
  // Yes, because it is causing a bug. If I unsubscribe from a feed and some entries from that
  // feed were loaded in the UI, those entries are still present in the UI. And they still
  // contribute to the unread count.

  // I may have done the above but have not fully tested.

  //const slides = document.body.querySelectorAll('article[entry]:not([read])');
  //return slides.length;

  const slides = document.body.querySelectorAll('article[entry]');
  let count = 0;
  for(const slide of slides) {
    if(slide.hasAttribute('read')) {
      continue;
    }

    // Only increment count if slide not tagged as removed after load
    if(slide.hasAttribute('removed-after-load')) {
      console.debug('Ignoring slide removed after load when counting unread',
        slide.getAttribute('entry'));
      continue;
    }

    count++;
  }
  return count;
}

let keydownTimerId = null;

function onKeyDown(event) {
  // Translate space from page down to show next slide
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  switch(code) {
  case RIGHT:
  case N:
  case SPACE: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(showNextSlide);

    break;
  }

  case LEFT:
  case P: {
    event.preventDefault();
    cancelIdleCallback(keydownTimerId);
    keydownTimerId = requestIdleCallback(showPreviousSlide);
    break;
  }
  default:
    break;
  }
}

window.addEventListener('keydown', onKeyDown);

// Override built in keyboard scrolling
let scrollCallbackHandle;
function onSlideScroll(event) {
  const DOWN = 40, UP = 38;
  function onIdleCallback() {
    const delta = event.keyCode === UP ? -200 : 200;
    document.activeElement.scrollTop += delta;
  }

  if(event.keyCode !== DOWN && event.keyCode !== UP) {
    return;
  }

  if(!document.activeElement) {
    return;
  }

  event.preventDefault();
  cancelIdleCallback(scrollCallbackHandle);
  scrollCallbackHandle = requestIdleCallback(onIdleCallback);
}


let refreshInProgress = false;
async function refreshAnchorOnclick(event) {
  event.preventDefault();

  console.log('Clicked refresh button');

  if(refreshInProgress) {
    console.debug('Ignoring refresh button click');
    return;
  }

  refreshInProgress = true;

  const pc = new PollContext();
  pc.initFaviconCache();
  pc.allowMeteredConnections = true;
  pc.ignoreRecencyCheck = true;
  pc.ignoreModifiedCheck = true;

  try {
    await pc.open();
    await pollFeeds.call(pc);
  } catch(error) {
    console.warn(error);
  } finally {
    pc.close();

    console.debug('Re-enabling refresh button');
    // Always renable
    refreshInProgress = false;
  }
}

function errorMessageContainerOnclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}

// Initialization
async function init() {
  showLoadingInformation();

  // Initialize error message container
  const container = document.getElementById('error-message-container');
  container.onclick = errorMessageContainerOnclick;


  // Initialize the menu

  // Initialize the refresh icon
  const refreshAnchor = document.getElementById('refresh');
  refreshAnchor.onclick = refreshAnchorOnclick;

  // Initialize entry display settings
  pageStyleSettingsOnload();

  // Load and append slides
  let conn;
  try {
    conn = await openReaderDb();
    await appendSlides(conn);
  } finally {
    hideLoadingInformation();
    IndexedDbUtils.close(conn);
  }
}

init().catch(console.warn);
