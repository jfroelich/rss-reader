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
import * as idb from "/src/utils/indexeddb-utils.js";
import {parseInt10} from "/src/utils/string.js";

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
    console.debug('Ignoring untrusted message event', event);
    return;
  }

  const message = event.data;
  if(typeof message !== 'object' || message === null) {
    console.warn('message event contains invalid message', message);
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
    onEntryBecameUnviewable(message.id, 'deleted').catch(console.warn);
    break;
  case 'entry-archived':
    onEntryBecameUnviewable(message.id, 'archived').catch(console.warn);
    break;
  case 'feed-deleted':
    console.warn('Unhandled feed-deleted message', message);
    break;
  default:
    console.warn('unknown message type', message);
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
  if(unreadSlideCount > 1) {
    return;
  }

  // Load new articles
  let conn;
  try {
    conn = await openReaderDb();
    await appendSlides(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    idb.close(conn);
  }
}

async function onEntryBecameUnviewable(entryId, reason) {
  // TEMP: note that entry id arrived possibly over the wire. I believe deserialization converts
  // it correctly back to an number. Not entirely sure. This assert is both to check that and
  // just to check in general.
  assert(Entry.isValidId(entryId));

  // Find all slides and remove them.

  // Find the entry's slide. There should only be one so the first match is fine.
  const slide = document.querySelector('article[entry="' + entryId + '"]');
  if(!slide) {
    return;
  }

  // TODO: once I get the new mechanism working, rename the attribute to 'stale'. Use the concept
  // of stale/fresh to indicate whether a slide loaded into the view is still present/active in the
  // database. I think freshness is just a better representation.

  if(slide === currentSlide) {
    console.warn('cannot remove current slide after load');
    slide.setAttribute('removed-after-load', '');
    return;
  }

  removeSlide(slide);
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

  // Immediately check if the slide should be ignored. One reason is that it was externally
  // made unviewable by some other background process like unsubscribe or archive after the slide
  // was loaded into view, but at the time it was made unviewable it was not unloadable from the
  // view.
  if(slideElement.hasAttribute('removed-after-load')) {
    console.debug('canceling mark as read given that slide removed after load',
      slideElement.getAttribute('entry'));
    return;
  }

  // This is a routine situation such as when navigating backward and therefore not an error.
  if(slideElement.hasAttribute('read')) {
    console.debug('canceling mark as read as slide already marked',
      slideElement.getAttribute('entry'));
    return;
  }

  const slideEntryAttributeValue = slideElement.getAttribute('entry');
  const entryId = parseInt10(slideEntryAttributeValue);

  assert(idb.isOpen(conn));
  assert(Entry.isValidId(entryId));

  try {
    await entryMarkRead(conn, entryId);
  } catch(error) {
    console.warn(error);
    return;
  }

  slideElement.setAttribute('read', '');
}

// TODO: visual feedback on error
async function appendSlides(conn) {
  const limit = 3;
  let entries = [];
  const offset = countUnreadSlides();

  try {
    entries = await findViewableEntriesInDb(conn, offset, limit);
  } catch(error) {
    // TODO: visual feedback in event of an error
    console.warn(error);
    return 0;
  }

  for(const entry of entries) {
    appendSlide(entry);
  }

  return entries.length;
}

// Add a new slide to the view.
function appendSlide(entry) {
  assert(Entry.isEntry(entry));

  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('article');

  // tabindex must be explicitly defined for article.focus()
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

  // TODO: this might be wrong if multiple unread slides are initially appended. I need to ensure
  // currentSlide is always set. Where do I do this?
  // TODO: clarify the above comment, I have no idea what I am talking about
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
  titleElement.setAttribute('target','_blank');

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
  // message and exit. Perhaps this should show an error message eventually.
  if(!anchor.hasAttribute('href')) {
    console.warn('clicked anchor without href that should have been caught by preprocessing',
      anchor.outerHTML);
    return true;
  }

  // We've determined at this point we are going to handle the click. Inform the browser that we
  // are intercepting.
  event.preventDefault();

  // Get the url and open the url in a new tab.
  // TODO: yes, this is worthy of an assert in the sense that all urls should have been made
  // canonical. But now we are at the point of the UI where even when bad things happen it should
  // still be a nice experience. Instead of just logging an error to the console. Show an alert
  // or something to the user, and exit early. Also note that we don't want to allow openTab
  // to substitute in chrome-extension://. Basically disallow that behavior unless the anchor
  // itself is a canonical url with that protocol. If it is, allow the click, as I don't think
  // it our concern any longer if something bad happens.
  const urlString = anchor.getAttribute('href');
  assert(isCanonicalURLString(urlString));
  openTab(urlString);

  // After opening the link in a new tab, then continue processing. Next, find the slide that was
  // clicked. This is typically the current slide, but that isn't guaranteed. Article elements are
  // filtered from document content, so the only time an ancestor of the anchor is an article is
  // when it is the slide that contains the anchor.
  // TODO: could this be sped up given closest includes self behavior to call closed on parent node
  // instead of the anchor itself?
  const clickedSlide = anchor.closest('article');

  // Throw an assertion error if we didn't find the containing slide.
  // TODO: don't assert at the UI level. Do something like show a human-friendly error message and
  // exit early.
  assert(clickedSlide instanceof Element);

  // Weak sanity check that the element is a slide, mostly just to monitor the recent changes to
  // this function.
  if(clickedSlide !== currentSlide) {
    console.debug('Determined that clicked slide is different than current slide', clickedSlide,
      currentSlide);
  }

  // Before even calling mark as read, and even though mark as read also does this check, check
  // here if the slide was made unviewable after load and exit early in this case. I am assuming
  // that the duplicate check and redundant concern is worth it due to the performance overhead
  // of opening a new connection and calling more functions. Although admittedly this isn't
  // performance sensitive I feel it is more polite.
  if(clickedSlide.hasAttribute('removed-after-load')) {
    console.debug('exiting click handler early due to delete-after-load situation');
    return false;
  }

  // in the current tab and mark the
  // slide as read.
  let conn;
  try {
    conn = await openReaderDb();
    await markSlideRead(conn, clickedSlide);
  } catch(error) {
    console.warn(error);
  } finally {
    idb.close(conn);
  }

  // Still signal the click should not default to normal click behavior, the browser should not
  // react to the click on its own. Even though I already called preventDefault.
  return false;
}

// TODO: visual feedback on error
async function showNextSlide() {

  // currentSlide may be undefined. This isn't actually an error. For example, when initially
  // viewing the slideshow before subscribing when there are no feeds and entries, or initially
  // viewing the slideshow when all entries are read.
  if(!currentSlide) {
    console.warn('no current slide');
    return;
  }

  // TODO: why is this always opening a connection even if there is no nextSibling?
  // That seems wrong, in the performance sense. But not sure.

  // TODO: we cannot naively use nextSibling. nextSibling may have been marked as
  // 'deleted-after-load'. We want to scan forward to the first subsequent slide that is not
  // deleted after load, and then switch to that.

  // Change this to first synchronously find the next slide to navigate to. Do not assume it is
  // next sibling.

  // If no next sibling is found, then this should exit early, or try and load new slides and
  // then navigate to. The deleted-after-load should no longer be a concern because the slides
  // are fresh.

  // TODO: also, if the currentSlide was marked as 'deleted-after-load' it should now be
  // immediately unloaded on navigation away? But does that cause surprise? Maybe call a helper
  // like 'onSlideLeavingView' that does this check?


  // Search for the next slide to show. The next slide is not necessarily adjacent.
  // TODO: cleanup the iteration logic once it becomes clearer to me.
  let nextSlide;
  let slideCursor = currentSlide;
  while(true) {
    slideCursor = slideCursor.nextSibling;
    if(slideCursor) {

      if(slideCursor.hasAttribute('removed-after-load')) {
        continue;
      } else {
        nextSlide = slideCursor;
        break;
      }

    } else {
      // If we advanced and there was no next sibling, leave nextSlide undefined and end search
      break;
    }
  }

  // I am not implementing this fully. First check the results of finding next slide in situations
  // such as no additional slides preloaded, or slides loaded but skipped because removed after
  // load.
  console.debug('next slide vs nextSibling', nextSlide, currentSlide.nextSibling);


  const oldSlideElement = currentSlide;
  let slideAppendCount = 0;
  let conn;
  try {
    conn = await openReaderDb();

    // Conditionally append more slides
    const unreadSlideElementCount = countUnreadSlides();
    if(unreadSlideElementCount < 2) {
      slideAppendCount = await appendSlides(conn);
    }

    if(currentSlide.nextSibling) {
      currentSlide.style.left = '-100%';
      currentSlide.style.right = '100%';
      currentSlide.nextSibling.style.left = '0px';
      currentSlide.nextSibling.style.right = '0px';
      currentSlide.scrollTop = 0;
      currentSlide = currentSlide.nextSibling;

      // Change the active element to the new current slide, so that scrolling with keys works
      currentSlide.focus();

      // Only mark the slide as read if navigation occurs, which only occurs if there was a next
      // slide
      await markSlideRead(conn, oldSlideElement);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    idb.close(conn);
  }

  // If more slides were appended, then reduce the number of slides loaded.
  // TODO: should this do a scan of slides that are marked 'removed-after-load' at this time and
  // try and remove any of them, regardless of max slide count or min slide count or whatever? And
  // regardless of whether slides were appended?

  if(slideAppendCount > 0) {
    assert(currentSlide);
    const maxSlideCount = 6;
    const containerElement = document.getElementById('slideshow-container');
    while(containerElement.childElementCount > maxSlideCount && containerElement.firstChild !==
      currentSlide) {
      removeSlide(containerElement.firstChild);
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

  const slides = document.body.querySelectorAll('article[entry]:not([read])');
  return slides.length;
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

// Initialization
async function init() {
  showLoadingInformation();

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
    idb.close(conn);
  }
}

init().catch(console.warn);
