import assert from '/lib/assert.js';
import downloadXMLDocument from '/lib/download-xml-document.js';
import { exportOPML, Outline } from '/lib/export-opml.js';
import * as favicon from '/lib/favicon.js';
import filterPublisher from '/lib/filter-publisher.js';
import formatDate from '/lib/format-date.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';
import importOPML from '/src/import-opml.js';
import { pollFeeds, PollFeedsArgs } from '/src/poll-feeds.js';
import refreshBadge from '/src/refresh-badge.js';

const splashElement = document.getElementById('initial-loading-panel');
const feedsContainerElement = document.getElementById('feeds-container');
if (feedsContainerElement) {
  feedsContainerElement.onclick = feedsContainerOnclick;
} else {
  console.warn('could not find feeds-container');
}

// Slide animation speed (smaller is faster), floating point
let transitionDuration;
function initTransitionDuration() {
  const defaultDuration = 0.16;
  const durationFloat = config.readFloat('slide_transition_duration');
  transitionDuration = isNaN(durationFloat) ? defaultDuration : durationFloat;
}
initTransitionDuration();

let channel;
let refreshInProgress = false;
const noArticlesElement = document.getElementById('no-entries-message');
let currentSlide = null;
let activeTransitionCount = 0;

async function showNextSlide() {
  const maxLoadCount = 6;

  if (getActiveTransitionCount()) {
    return;
  }

  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    return;
  }

  const conn = await db.open();
  await markSlideReadStart(conn, currentSlide);

  const slideUnreadCount = countUnreadSlides();
  let entries = [];
  if (slideUnreadCount < 3) {
    const mode = 'viewable-entries';
    const offset = slideUnreadCount;
    let limit;
    const configLimit = config.readInt('initial_entry_load_limit');
    if (!isNaN(configLimit)) {
      limit = configLimit;
    }
    entries = await db.getResources(
      {
        conn, mode, offset, limit,
      },
    );
  }
  conn.close();

  for (const entry of entries) {
    if (!document.querySelector(`slide[entry="${entry.id}"]`)) {
      appendSlide(entry);
    } else {
      console.debug('Entry already loaded', entry.id);
    }
  }

  const nextSlide = currentSlide.nextElementSibling;
  if (nextSlide) {
    incrementActiveTransitionCount();
    currentSlide.style.left = '-100%';
    nextSlide.style.left = '0';
    setCurrentSlide(nextSlide);
  }

  if (entries.length) {
    compactSlides(maxLoadCount);
  }
}

function compactSlides(maxLoadCount = 6) {
  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    return;
  }

  // The maximum number of slides loaded at any one time.
  const container = document.getElementById('slideshow-container');
  let firstSlide = container.firstElementChild;
  while (container.childElementCount > maxLoadCount && firstSlide !== currentSlide) {
    removeSlide(firstSlide);
    firstSlide = container.firstElementChild;
  }
}

function showPreviousSlide() {
  if (getActiveTransitionCount()) {
    console.debug(
      'Transition in progress, canceling navigation to previous slide',
    );
    return;
  }

  const currentSlide = getCurrentSlide();
  if (!currentSlide) {
    return;
  }

  const previousSlide = currentSlide.previousElementSibling;
  if (!previousSlide) {
    return;
  }

  incrementActiveTransitionCount();
  currentSlide.style.left = '100%';
  previousSlide.style.left = '0';
  setCurrentSlide(previousSlide);
}

function getCurrentSlide() {
  return currentSlide;
}

function setCurrentSlide(slideElement) {
  currentSlide = slideElement;
}

function isCurrentSlide(slideElement) {
  return slideElement === currentSlide;
}

function getActiveTransitionCount() {
  return activeTransitionCount;
}

function setActiveTransitionCount(count) {
  activeTransitionCount = count;
}

function incrementActiveTransitionCount() {
  activeTransitionCount++;
}

function decrementActiveTransitionCount() {
  // Do not allow transition to negative
  if (activeTransitionCount > 0) {
    activeTransitionCount--;
  }
}

async function slideOnclick(event) {
  // Only intercept left clicks
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  // Only intercept clicks on or within an anchor element
  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  const urlString = anchor.getAttribute('href');
  if (!urlString) {
    return;
  }

  event.preventDefault();
  open(urlString, '_blank');

  // Find the clicked slide. Start from parent because we know that the anchor
  // itself is not a slide. We know that a slide will always be found
  const slide = anchor.parentNode.closest('slide');

  // If the click was on the article title, mark as read always. If not then
  // it depends on whether url is similar.
  if (!anchor.matches('.entry-title')) {
    const entryURL = findSlideURL(slide);
    if (entryURL) {
      let clickedURL;
      try {
        clickedURL = new URL(urlString);
      } catch (error) {
        // if there is a problem with the url itself, no point in trying to
        // mark as read
        console.warn(error);
        return;
      }

      if (clickedURL) {
        // If the click was on a link that does not look like it points to the
        // article, then do not mark as read
        if (!urlsAreSimilar(entryURL, clickedURL)) {
          return;
        }
      }
    }
  }

  // Mark the clicked slide as read. While these conditions are redundant with
  // the checks within markSlideReadStart, it avoids opening the connection.
  if (!slide.hasAttribute('stale') && !slide.hasAttribute('read')
      && !slide.hasAttribute('read-pending')) {
    const conn = await db.open();
    await markSlideReadStart(conn, slide);
    conn.close();
  }
}

// Return whether both urls point to the same entry
// TODO: make this stricter. This should be checking path
function urlsAreSimilar(entryURL, clickedURL) {
  return entryURL.origin === clickedURL.origin;
}

// Find the entry url of the slide. This is a hackish solution to the problem
// that for each anchor clicked I need to be able to compare it to the url of
// the article containing the anchor, but the view doesn't provide this
// information upfront, so we have to go and find it again. Given that we are in
// a forked event handler, fortunately, performance is less concerning. In fact
// it is feels better to defer this cost until now, rather than some upfront
// cost like storing the href as a slide attribute or per anchor or calculating
// some upfront per-anchor attribute as an apriori signal.
function findSlideURL(slide) {
  const titleAnchor = slide.querySelector('a.entry-title');
  // Should never happen. I suppose it might depend on how a slide without a
  // url is constructed in html. We cannot rely on those other implementations
  // here because we pretend not to know how those implementations work.
  if (!titleAnchor) {
    return;
  }

  const entryURL = titleAnchor.getAttribute('href');
  // Can happen, as the view makes no assumptions about whether articles have
  // urls (only the model imposes that constraint)
  if (!entryURL) {
    return;
  }

  let entryURLObject;
  try {
    entryURLObject = new URL(entryURL);
  } catch (error) {
    // If there is an entry title with an href value, it should pretty much
    // always be valid. But we are in a context where we cannot throw the error
    // or deal with it, so we just log as a non-fatal but significant error.
    console.warn(error);
  }

  return entryURLObject;
}

function showNoArticlesMessage() {
  noArticlesElement.style.display = 'block';
}

function hideNoArticlesMessage() {
  noArticlesElement.style.display = 'none';
}

// Starts transitioning a slide into the read state. Updates both the view and
// the database. This resolves before the view is fully updated.
function markSlideReadStart(conn, slide) {
  const entryIdString = slide.getAttribute('entry');
  const entryId = parseInt(entryIdString, 10);

  // Exit if prior call still in flight. Callers may naively make concurrent
  // calls to markSlideReadStart. This is routine, expected, and not an
  // error.
  if (slide.hasAttribute('read-pending')) {
    return Promise.resolve();
  }

  // The slide was already read. Typically happens when navigating away from a
  // slide a second time. Not an error.
  if (slide.hasAttribute('read')) {
    return Promise.resolve();
  }

  // A slide is stale for various reasons such as its corresponding entry being
  // deleted from the database. Callers are not expected to avoid calling this
  // on stale slides. Not an error.
  if (slide.hasAttribute('stale')) {
    return Promise.resolve();
  }

  // Signal to future calls that this is now in progress
  slide.setAttribute('read-pending', '');

  return db.patchResource(conn, { id: entryId, read: 1 });
}

function removeSlide(slide) {
  slide.remove();
  slide.removeEventListener('click', slideOnclick);
}

// This should be called once the view acknowledges it has received the message
// sent to the  by markSlideReadStart to fully resolve the mark read
// operation.
function markSlideReadEnd(slide) {
  if (slide.hasAttribute('read')) {
    console.warn('Called mark-slide-read-end on an already read slide?', slide);
    return;
  }

  // Do not exit early if the slide is stale. Even though updating the state of
  // a stale slide seems meaningless, other algorithms such as counting unread
  // slides may be naive and only consider the read attribute
  slide.setAttribute('read', '');
  slide.removeAttribute('read-pending');
}

async function refreshButtonOnclick(event) {
  event.preventDefault();

  if (refreshInProgress) {
    console.debug('Ignoring click event because refresh in progress');
    return;
  }

  refreshInProgress = true;

  const promises = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);
  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.ignoreRecencyCheck = true;
  await pollFeeds(args);
  conn.close();
  iconn.close();

  refreshInProgress = false;
}

function toggleLeftPanelButtonOnclick(event) {
  const menuOptions = document.getElementById('left-panel');
  if (menuOptions.style.marginLeft === '0px') {
    hideOptionsMenu();
  } else if (menuOptions.style.marginLeft === '') {
    showOptionsMenu();
  } else {
    showOptionsMenu();
  }
}

function viewArticlesButtonOnclick(event) {
  // First toggle button states.

  // We are switching to the view-articles state. The view-feeds button may
  // have been disabled. Ensure it is enabled.
  const feedsButton = document.getElementById('feeds-button');
  feedsButton.disabled = false;

  // We are switch to the view-articles state. Disable the view-articles button
  // in the new state.
  const readerButton = document.getElementById('reader-button');
  readerButton.disabled = true;

  // Hide the view-feeds panel.
  const feedsContainerElement = document.getElementById('feeds-container');
  feedsContainerElement.style.display = 'none';

  // Show the view-articles panel.
  const slideshowContainerElement = document.getElementById('slideshow-container');
  slideshowContainerElement.style.display = 'block';

  // The visibility of the no-articles-to-display message is independent of
  // the slideshow-container. It must be manually made visible again if there
  // are no articles.
  const slideCount = slideshowContainerElement.childElementCount;
  if (!slideCount) {
    showNoArticlesMessage();
  }
}

function viewFeedsButtonOnclick(event) {
  const feedsButton = document.getElementById('feeds-button');
  feedsButton.disabled = true;

  const readerButton = document.getElementById('reader-button');
  readerButton.disabled = false;

  const slideshowContainerElement = document.getElementById('slideshow-container');
  slideshowContainerElement.style.display = 'none';

  // The 'no articles to display' message is not contained within the slideshow
  // container, so it must be independently hidden
  hideNoArticlesMessage();

  const feedsContainerElement = document.getElementById('feeds-container');
  feedsContainerElement.style.display = 'block';
}

const toggleLeftPanelButton = document.getElementById('main-menu-button');
toggleLeftPanelButton.onclick = toggleLeftPanelButtonOnclick;

const refreshButton = document.getElementById('refresh');
refreshButton.onclick = refreshButtonOnclick;

const feedsButton = document.getElementById('feeds-button');
feedsButton.onclick = viewFeedsButtonOnclick;

const readerButton = document.getElementById('reader-button');
readerButton.onclick = viewArticlesButtonOnclick;

function showOptionsMenu() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '0';
  menuOptions.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

function hideOptionsMenu() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '-320px';

  // TODO: do I just delete the prop? How to set back to initial or whatever?
  // Is it by setting to 'none' or 'initial' or 'inherit' or something like
  // that?
  menuOptions.style.boxShadow = '';
}

function importOPMLPrompt() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'application/xml');
  input.onchange = async function inputOnchange(event) {
    // For unknown reason we must grab this before the await, otherwise error.
    // This behavior changed sometime around Chrome 72 without notice
    const { files } = event.target;
    const conn = await db.open();
    await importOPML(conn, files);
    conn.close();
  };
  input.click();
}

// TODO: handling all clicks and then forwarding them to click handler seems
// dumb. I should be ignoring clicks on such buttons. Let them continue
// propagation. The buttons should instead have their own handlers.
async function optionsMenuOnclick(event) {
  const option = event.target;
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      alert('Not yet implemented, subscribe using options page');
      break;
    case 'menu-option-import':
      importOPMLPrompt();
      break;
    case 'menu-option-export':
      // Load all feeds from the database
      const conn = await db.open();
      const resources = await db.getResources({ conn, mode: 'feeds' });
      conn.close();

      // Convert the loaded feeds into outlines
      const outlines = resources.map((resource) => {
        const outline = new Outline();
        outline.type = resource.feed_format;

        if (db.hasURL(resource)) {
          outline.xmlUrl = db.getURLString(resource);
        }

        outline.title = resource.title;
        outline.description = resource.description;
        outline.htmlUrl = resource.link;
        return outline;
      });

      const document = await exportOPML(outlines, 'Subscriptions');
      downloadXMLDocument(document, 'subscriptions.xml');
      break;
    case 'menu-option-header-font':
      break;
    case 'menu-option-body-font':
      break;
    default:
      console.warn('Unhandled menu option click', option.id);
      break;
  }
}

function headerFontMenuInit(fonts) {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = headerFontMenuOnchange;
  const currentHeaderFontName = config.readString('header_font_family');
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Header Font';
  menu.append(defaultOption);

  for (const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if (fontName === currentHeaderFontName) {
      option.selected = true;
    }
    menu.append(option);
  }
}

function bodyFontMenuInit(fonts) {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = bodyFontMenuOnchange;
  const currentBodyFont = config.readString('body_font_family');
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Body Font';
  menu.append(defaultOption);

  for (const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if (fontName === currentBodyFont) {
      option.selected = true;
    }
    menu.append(option);
  }
}

function headerFontMenuOnchange(event) {
  const fontName = event.target.value;
  const oldValue = config.readString('header_font_family');
  if (fontName) {
    config.writeString('header_font_family', fontName);
  } else {
    config.remove('header_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config.storageOnchange({
    isTrusted: true,
    type: 'storage',
    key: 'header_font_family',
    newValue: fontName,
    oldValue,
  });
}

function bodyFontMenuOnchange(event) {
  const fontName = event.target.value;
  const oldValue = config.readString('body_font_family');
  if (fontName) {
    config.writeString('body_font_family', fontName);
  } else {
    config.remove('body_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config.storageOnchange({
    isTrusted: true,
    type: 'storage',
    key: 'body_font_family',
    newValue: fontName,
    oldValue,
  });
}

// Handle clicks outside of the left panel. The left panel should close by
// clicking anywhere else. So we listen for clicks anywhere, check if the click
// was outside of the left panel, and if so, then hide the left panel. Ignored
// clicks are left as is, and passed along untouched to any other listeners.
// Clicks on the main menu are ignored because that is considered a part of the
// menu structure. Clicks on the left panel are ignored because that should not
// cause the left panel to hide.
function windowOnclick(event) {
  const avoidedZoneIds = ['main-menu-button', 'left-panel'];

  if (!avoidedZoneIds.includes(event.target.id)
      && !event.target.closest('[id="left-panel"]')) {
    const leftPanelElement = document.getElementById('left-panel');

    if (leftPanelElement.style.marginLeft === '0px') {
      hideOptionsMenu();
    }
  }

  return true;
}

function initLeftPanel() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.onclick = optionsMenuOnclick;

  // Load fonts from configuration once for both init helpers
  const fonts = config.readArray('fonts');
  headerFontMenuInit(fonts);
  bodyFontMenuInit(fonts);

  addEventListener('click', windowOnclick);
}

// Initialize things on module load
initLeftPanel();

function initChannel() {
  if (channel) {
    throw new Error('channel already initialized');
  }

  channel = new BroadcastChannel('reader');
  channel.onmessage = onmessage;
  channel.onmessageerror = onmessageerror;
}

// React to an incoming message event to the channel
async function onmessage(event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  // Common behavior for type handlers related to updating the badge
  const badgeMessageTypes = ['resource-created', 'resource-updated', 'resource-deleted'];
  if (badgeMessageTypes.includes(message.type)) {
    refreshBadge().catch(console.warn); // intentionally unawaited
  }

  if (message.type === 'resource-updated') {
    // If the update event represents a transition from unread to unread, it may
    // relate to a slide presently loaded that needs to be updated.
    if (message.read) {
      const slide = findSlideByEntryId(message.id);
      if (slide) {
        markSlideReadEnd(slide);
      }
    }

    // Because we do not support hot-swapping there is nothing else to do
    // TODO: maybe mark the entry as stale because it is now possibly out of
    // sync?
    return;
  }

  if (message.type === 'resource-created') {
    // Determine whether new articles should be loaded as a result of new
    // articles being added to the database.
    // TODO: this should come from config
    const maxUnreadSlideCountBeforeSuppressLoading = 3;
    const unreadSlideCount = countUnreadSlides();
    // If there are already enough unread articles loaded, do nothing.
    if (unreadSlideCount > maxUnreadSlideCountBeforeSuppressLoading) {
      return;
    }

    // Query for and append new slides. They might get appended and become
    // immediately visible, or they may be rendered offscreen, but still
    // appended to the dom, in expectation of later viewing. The append call
    // takes care of whether an article should initially appear as visible, so
    // it is not our concern.

    // This currently does some funkiness to avoid loading a new article when
    // that article isn't actually new in the sense it somehow already exists in
    // the view. Maybe because this function was somehow running concurrently
    // with itself. What this does it make the assumption that the number of
    // unread are the most recently added because that is the order in which
    // articles are loaded, and it just jumps past them to the next first unread
    // not yet loaded. So we specify the current unread count as the number of
    // articles to skip over in the query.

    // TODO: what this should be doing instead is specifying the number of
    // remaining articles in the view, read or unread, as the offset. That or
    // just inventing an approach that doesn't run headfirst into this crappy
    // logic.

    const conn = await db.open();
    const entries = await db.getResources({
      conn,
      mode: 'viewable-entries',
      offset: unreadSlideCount,
      limit: undefined,
    });
    conn.close();

    for (const entry of entries) {
      appendSlide(entry);
    }
    return;
  }

  if (message.type === 'resource-deleted' || message.type === 'resource-archived') {
    const slide = findSlideByEntryId(message.id);
    if (slide) {
      if (isCurrentSlide(slide)) {
        // TODO: set to empty string instead?
        slide.setAttribute('stale', 'true');
      } else {
        removeSlide(slide);
      }
    }
    return;
  }

  if (message.type === 'resource-deleted') {
    // TODO: implement
    return;
  }

  if (message.type === 'resource-activated') {
    // TODO: implement
    return;
  }

  if (message.type === 'resource-deactivated') {
    // TODO: implement
    return;
  }


  // All types should be explicitly handled, even if they do nothing but exit.
  // This message appearing serves as a continual incentive.
  console.warn('Unhandled message', message);
}

function onmessageerror(event) {
  console.warn(event);
}

function findSlideByEntryId(entryId) {
  return document.querySelector(`slide[entry="${entryId}"]`);
}

function appendSlide(entry) {
  // Now that we know there will be at least one visible article, ensure the
  // no articles message is hidden
  hideNoArticlesMessage();

  const slide = createSlide(entry);
  attachSlide(slide);
}

function createSlide(entry) {
  assert(Array.isArray(entry.urls));
  assert(entry.urls.length > 0);

  const slide = document.createElement('slide');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');

  const slidePaddingWrapperElement = document.createElement('div');
  slidePaddingWrapperElement.className = 'slide-padding-wrapper';
  slidePaddingWrapperElement.append(createArticleTitleElement(entry));
  slidePaddingWrapperElement.append(createArticleContentElement(entry));
  slidePaddingWrapperElement.append(createFeedSourceElement(entry));
  slide.append(slidePaddingWrapperElement);
  return slide;
}

function createArticleTitleElement(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', entry.urls[entry.urls.length - 1]);
  titleElement.setAttribute('class', 'entry-title');
  titleElement.setAttribute('rel', 'noreferrer');

  // NOTE: title is a dom string and therefore may contain html tags and
  // entities. When an entry is saved into the database, its title is
  // sanitized and tags are removed, but entities remain. Therefore, the title
  // loaded here does not need to undergo further sanization. Previously this
  // was an error where the title underwent a second round of encoding,
  // leading to encoded entities appearing in the UI.

  // In addition, this relies on using CSS to truncate the title as needed
  // instead of explicitly truncating the value here.
  const title = entry.title || 'Untitled';
  titleElement.setAttribute('title', title);
  titleElement.innerHTML = filterPublisher(title);
  return titleElement;
}

function createArticleContentElement(entry) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  contentElement.innerHTML = entry.content;
  return contentElement;
}

function createFeedSourceElement(entry) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class', 'entry-source');

  if (entry.favicon_url) {
    let faviconURL;
    try {
      faviconURL = new URL(entry.favicon_url);
    } catch (error) {
    }

    if (!faviconURL || faviconURL.protocol === 'chrome-extension:') {
      console.debug('Bad favicon url', entry.favicon_url);
    } else {
      const favicon_element = document.createElement('img');
      favicon_element.setAttribute('src', entry.favicon_url);
      favicon_element.setAttribute('width', '16');
      favicon_element.setAttribute('height', '16');
      sourceElement.append(favicon_element);
    }
  }

  const details = document.createElement('span');
  if (entry.feedLink) {
    details.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feed_title || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if (entry.published_date) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.published_date));
  }
  details.textContent = buffer.join('');
  sourceElement.append(details);
  return sourceElement;
}

// TODO: this helper should probably be inlined into appendSlide once I work
// out the API better. One of the main things I want to do is resolve the
// mismatch between the function name, append-slide, and its main parameter,
// a database entry object. I think the solution is to separate
// entry-to-element and append-element. This module should ultimately focus
// only on appending, not creation and coercion.
function attachSlide(slide) {
  const container = document.getElementById('slideshow-container');

  // Defer binding event listener until appending here, not earlier when
  // creating the element. We are not sure a slide will be used until it is
  // appended, and want to avoid attaching listeners to unused detached
  // elements.
  slide.addEventListener('click', slideOnclick);

  // In order for scrolling to react to keyboard shortcuts such as pressing
  // the down arrow key, the element must be focused, and in order to focus an
  // element, it must have the tabindex attribute.
  slide.setAttribute('tabindex', '-1');

  // Slides are positioned absolutely. Setting left to 100% places the slide
  // off the right side of the view. Setting left to 0 places the slide in the
  // view. The initial value must be defined here and not via css, before
  // adding the slide to the page. Otherwise, changing the style for the first
  // slide causes an unwanted transition, and I have to change the style for
  // the first slide because it is not set in css.
  slide.style.left = container.childElementCount === 0 ? '0' : '100%';

  // TODO: review if webkit prefix was dropped for webkitTransitionEnd

  // In order for scrolling a slide element with keyboard keys to work, the
  // slide must be focused. But calling element.focus() while a transition is
  // active, such as what happens when a slide is moved, interrupts the
  // transition. Therefore, schedule focus for when the transition completes.
  slide.addEventListener('webkitTransitionEnd', transitionOnend);

  // The value of the transitionDuration variable is defined external to this
  // function, because it is mutable by other functions.

  // Define the animation effect that will occur when moving the slide. Slides
  // are moved by changing a slide's css left property. This triggers a
  // transition. The transition property must be defined dynamically in order
  // to have the transition only apply to a slide when it is in a certain
  // state. If set via css then this causes an undesirable immediate
  // transition on the first slide.
  slide.style.transition = `left ${transitionDuration}s ease-in-out`;

  // Initialize the current slide if needed
  if (!getCurrentSlide()) {
    // TODO: is this right? I think it is because there is no transition for
    // first slide, so there is no focus call. But maybe not needed?
    slide.focus();
    setCurrentSlide(slide);
  }

  container.append(slide);
}

function isValidTransitionDuration(transitionDuration) {
  return !isNaN(transitionDuration) && isFinite(transitionDuration)
      && transitionDuration >= 0;
}

function setTransitionDuration(input_duration) {
  if (!isValidTransitionDuration(input_duration)) {
    throw new TypeError(
      'Invalid transitionDuration parameter', input_duration,
    );
  }

  transitionDuration = input_duration;
}

// Handle the end of a transition. Should not be called directly.
function transitionOnend(event) {
  // The slide that the transition occured upon (event.target) is not
  // guaranteed to be equal to the current slide. We want to affect the
  // current slide. We fire off two transitions per animation, one for the
  // slide being moved out of view, and one for the slide being moved into
  // view. Both transitions result in call to this listener, but we only want
  // to call focus on one of the two elements. We want to be in the state
  // where after both transitions complete, the new slide (which is the
  // current slide at this point) is now focused. Therefore we ignore
  // event.target and directly affect the current slide only.
  const slide = getCurrentSlide();
  slide.focus();

  // There may be more than one transition effect occurring at the moment.
  // Inform others via global state that this transition completed.
  decrementActiveTransitionCount();
}

function activateButtonOnclick() {
  throw new Error('Not yet implemented');
}

function deactivateButtonOnclick() {
  throw new Error('Not yet implemented');
}

// Returns the number of unread slide elements present in the view
function countUnreadSlides() {
  const selector = 'slide:not([read]):not([read-pending])';
  const slides = document.body.querySelectorAll(selector);
  return slides.length;
}

function feedsContainerAppendFeed(feed) {
  const feedsContainerElement = document.getElementById('feeds-container');
  const feedElement = document.createElement('div');
  feedElement.id = feed.id;

  if (feed.active !== 1) {
    feedElement.setAttribute('inactive', 'true');
  }

  const titleElement = document.createElement('span');
  titleElement.textContent = feed.title;
  feedElement.append(titleElement);

  const feedInfoElement = document.createElement('table');

  let row = document.createElement('tr');
  let col = document.createElement('td');
  col.textContent = 'Description';
  row.append(col);
  col = document.createElement('td');
  col.textContent = feed.description || 'No description';
  row.append(col);
  feedInfoElement.append(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Webpage';
  row.append(col);
  col = document.createElement('td');
  col.textContent = feed.link || 'Not specified';
  row.append(col);
  feedInfoElement.append(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Favicon';
  row.append(col);
  col = document.createElement('td');
  col.textContent = feed.favicon_url || 'Unknown';
  row.append(col);
  feedInfoElement.append(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'URL';
  row.append(col);
  col = document.createElement('td');
  col.textContent = feed.urls[feed.urls.length - 1];
  row.append(col);
  feedInfoElement.append(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.setAttribute('colspan', '2');

  let button = document.createElement('button');
  button.value = `${feed.id}`;
  button.onclick = deactivateButtonOnclick;
  button.textContent = 'Unsubscribe';
  col.append(button);

  button = document.createElement('button');
  button.value = `${feed.id}`;
  button.onclick = activateButtonOnclick;
  button.textContent = 'Activate';
  if (feed.active === 1) {
    button.disabled = 'true';
  }
  col.append(button);

  button = document.createElement('button');
  button.value = `${feed.id}`;
  button.onclick = deactivateButtonOnclick;
  button.textContent = 'Deactivate';
  if (feed.active !== 1) {
    button.disabled = 'true';
  }
  col.append(button);

  row.append(col);
  feedInfoElement.append(row);
  feedElement.append(feedInfoElement);

  feedsContainerElement.append(feedElement);
}

function feedsContainerOnclick(event) {
  if (event.target.localName === 'div' && event.target.id) {
    toggleFeedDetails(event.target);
  }
}

function toggleFeedDetails(feedElement) {
  const table = feedElement.querySelector('table');
  if (feedElement.hasAttribute('expanded')) {
    feedElement.removeAttribute('expanded');
    feedElement.style.width = '200px';
    feedElement.style.height = '200px';
    feedElement.style.cursor = 'zoom-in';
    table.style.display = 'none';
  } else {
    feedElement.setAttribute('expanded', 'true');
    feedElement.style.width = '100%';
    feedElement.style.height = 'auto';
    feedElement.style.cursor = 'zoom-out';
    table.style.display = 'block';
  }
}

function onkeydown(event) {
  // Ignore edit intent
  const targetName = event.target.localName;
  if (targetName === 'input' || targetName === 'textarea') {
    return;
  }

  const LEFT = 37; const
    RIGHT = 39;
  const N = 78; const
    P = 80;
  const SPACE = 32;
  const code = event.keyCode;

  if (code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    showNextSlide();
  } else if (code === LEFT || code === P) {
    event.preventDefault();
    showPreviousSlide();
  }
}

function showSplashElement() {
  splashElement.style.display = 'block';
}

function hideSplashElement() {
  splashElement.style.display = 'none';
}

async function initializeSlideshowPage() {
  showSplashElement();

  const conn = await db.open();
  const getEntriesPromise = db.getResources(
    {
      conn, mode: 'viewable-entries', offset: 0, limit: 6,
    },
  );
  const getFeedsPromise = db.getResources({ conn, mode: 'feeds', titleSort: true });
  conn.close();

  // Wait for entries to finish loading (without regard to feeds loading)
  const entries = await getEntriesPromise;

  if (!entries.length) {
    showNoArticlesMessage();
  }

  for (const entry of entries) {
    appendSlide(entry);
  }

  // Hide the splash before feeds may have loaded. We start in the entries
  // 'tab' so the fact that feeds are not yet loaded should not matter.
  // NOTE: technically user can switch to feeds view before this completes.
  hideSplashElement();

  const feeds = await getFeedsPromise;
  for (const feed of feeds) {
    feedsContainerAppendFeed(feed);
  }
}

initChannel();
addEventListener('storage', config.storageOnchange);
addEventListener('keydown', onkeydown);
document.addEventListener('DOMContentLoaded', config.domLoadListener);

initializeSlideshowPage().catch(console.error);
