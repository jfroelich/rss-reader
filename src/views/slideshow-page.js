import {html_escape, html_truncate} from '/src/common/html-utils.js';
import entry_mark_read from '/src/feed-ops/mark-entry-read.js';
import {poll_service_close_context, poll_service_create_context, poll_service_poll_feeds} from '/src/feed-poll/poll-feeds.js';
import {ral_export, ral_import} from '/src/ral.js';
import {entry_is_entry, entry_is_valid_id, entry_peek_url, feed_peek_url, open as reader_db_open, reader_db_find_viewable_entries, reader_db_get_feeds} from '/src/rdb.js';
import * as PageStyle from '/src/views/page-style-settings.js';
import * as Slideshow from '/src/views/slideshow.js';

// BUG: some kind of mark-read bug, possibly due to the non-blocking call. The
// bug is logic, there is no js error. Entries are getting marked as read, but
// re-appear occassionally when navigation, and sometimes next-slide key press
// doesn't advance slide.

// clang-format off
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
// clang-format on

const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  if (!event.isTrusted) {
    console.warn('Untrusted event', event);
    return;
  }

  const message = event.data;
  if (typeof message !== 'object' || message === null) {
    console.warn('Invalid message', event);
    return;
  }

  switch (message.type) {
    case 'display-settings-changed':
      console.debug('Updating article style');
      PageStyle.pageStyleSettingsOnchange(message);
      break;
    case 'entry-added':
      on_entry_added_message(message).catch(console.warn);
      break;
    case 'entry-deleted':
      on_entry_expired_message(message).catch(console.warn);
      break;
    case 'entry-archived':
      on_entry_expired_message(message).catch(console.warn);
      break;
    case 'feed-deleted':
      console.warn('Unhandled feed-deleted message', message);
      break;
    case 'entry-marked-read':
      // TODO: call a mark read handler here that sets the slide element as read
      console.warn('Unhandled entry-marked-read message', message);
      break;
    case 'feed-added':
    case 'feed-updated':
    case 'feed-activated':
    case 'feed-deactivated':
      // console.debug('Ignoring message', message.type);
      break;
    default:
      console.warn('Unknown message type', message);
      break;
  }
};

channel.onmessageerror = function(event) {
  console.warn('Could not deserialize message from channel', event);
};

// Responds to the adding of an entry to the database from some background task.
// Conditionally appends new articles as slides.
async function on_entry_added_message(message) {
  // Do not append if several unread slides are still loaded
  const slide_unread_count = slideshow_count_unread();

  if (slide_unread_count > 3) {
    return;
  }

  let conn;
  try {
    conn = await reader_db_open();
    await slide_load_and_append_multiple(conn);
  } finally {
    if (conn) {
      conn.close();
    }
  }
}

function error_message_show(message_text) {
  const container = document.getElementById('error-message-container');

  if (!container) {
    console.error(
        'Could not find element #error-message-container to show error',
        message_text);
    return;
  }

  container.textContent = message_text;
  container.style.display = 'block';
}

// React to a message indicating that an entry expired (e.g. it was deleted, or
// archived)
async function on_entry_expired_message(message) {
  if (typeof message !== 'object') {
    console.warn('Invalid message', message);
    return;
  }

  if (!entry_is_valid_id(message.id)) {
    console.warn('Invalid entry id', message);
    return;
  }

  // Search for a slide corresponding to the entry id
  const slide_element_name = Slideshow.getElementName();
  const slide = document.querySelector(
      slide_element_name + '[entry="' + message.id + '"]');

  // There is no guarantee the entry id corresponds to a loaded slide. It is
  // normal and frequent for the slideshow to receive messages with entry ids
  // that do not correspond to loaded slides.
  if (!slide) {
    return;
  }

  // The slide currently being viewed was externally modified such that it
  // should no longer be viewed, so we could prefer to remove it from the view.
  // However, it is the current slide being viewed which would lead to surprise
  // as the article the user is reading is magically whisked away. Instead, flag
  // the slide as stale.
  if (Slideshow.isCurrentSlide(slide)) {
    slide.setAttribute('stale', 'true');
    return;
  }

  Slideshow.remove(slide);
  // TODO: because the click listener is done in slideshow-page instead of in
  // the Slideshow helper module, Slideshow.remove does not remove the listener,
  // so it has to be explicitly removed here. I would prefer something better. I
  // initially started doing the click handler within Slideshow, but it turns
  // out that there are several things that must happen in response to a click,
  // and I did a poor job of separating out the functionality
  slide.removeEventListener('click', slide_onclick);
}

function loading_info_show() {
  const loading_info_element = document.getElementById('initial-loading-panel');
  if (loading_info_element) {
    loading_info_element.style.display = 'block';
  } else {
    console.error('Could not find initial loading panel');
  }
}

function loading_info_hide() {
  const loading_info_element = document.getElementById('initial-loading-panel');
  if (loading_info_element) {
    loading_info_element.style.display = 'none';
  } else {
    console.error('Could not find initial loading panel');
  }
}

// TODO: I lost the non-blocking nature I was going for, so I need to rethink
// this.
async function slide_mark_read(conn, slide_element) {
  if (!(conn instanceof IDBDatabase)) {
    console.error('Invalid conn');
    return;
  }

  if (!(slide_element instanceof Element)) {
    console.error('Invalid slide_element');
    return;
  }

  // If the slide is stale, for whatever reason, do nothing
  if (slide.hasAttribute('stale')) {
    console.debug('slide is stale, not marking as read');
    return;
  }

  // Get and validate the entry id
  const entry_attribute_value = slide_element.getAttribute('entry');
  const entry_id = parseInt(entry_attribute_value, 10);
  if (!entry_is_valid_id(entry_id)) {
    console.error('Invalid entry id', entry_id);
    return;
  }

  console.log('Marking slide with entry id %d as read', entry_id);

  // Exit early if the slide has already been read. This is routine such as when
  // navigating backward then forward. navigation does not warrant that it
  // inspects slide state to determine whether to mark as read
  if (slide_element.hasAttribute('read')) {
    return;
  }

  // TODO: rather than await, this should listen for entry-marked-read events
  // roundtrip and handle the event when it later occurs to mark the
  // corresponding slide. Then this can be called non-awaited.

  try {
    await entry_mark_read(conn, channel, entry_id);
  } catch (error) {
    // TODO: display an error
    console.error(error);
    return;
  }

  // Signal to the UI that the slide is read, so that unread counting works, and
  // so that later calls to this function exit prior to interacting with
  // storage. This happens regardless of whether state updated correctly, at the
  // moment, because there is no easy way to tell whether an error occurred pre
  // or post commit (before state actually changed)
  slide_element.setAttribute('read', '');
}

// TODO: append slides shouldn't be responsible for loading. This should accept
// an array of slides as input. Something else should be doing loading.
async function slide_load_and_append_multiple(conn, limit) {
  limit = typeof limit === 'undefined' ? 3 : limit;
  console.log('Appending slides (limit: %d)', limit);
  const offset = slideshow_count_unread();

  let entries;
  try {
    entries = await reader_db_find_viewable_entries(conn, offset, limit);
  } catch (error) {
    console.error(error);
    error_message_show('There was a problem loading articles from storage');
    return 0;
  }

  for (const entry of entries) {
    slide_append(entry);
  }

  return entries.length;
}

// TODO: the creation of a slide element, and the appending of a slide element,
// should be two separate tasks. This will increase flexibility and maybe
// clarity. slide_append should accept a slide element, not an entry.

// Given an entry, create a new slide element and append it to the view
function slide_append(entry) {
  if (!entry_is_entry(entry)) {
    console.error('Invalid entry parameter', entry);
    return;
  }

  console.log('Creating and appending slide for entry', entry.id);
  const slide = Slideshow.create();
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');
  slide.addEventListener('click', slide_onclick);

  // An after-the-fact change to fix padding
  const slide_pad_wrap = document.createElement('div');
  slide_pad_wrap.className = 'slide-padding-wrapper';
  slide_pad_wrap.appendChild(create_article_title_element(entry));
  slide_pad_wrap.appendChild(create_article_content_element(entry));
  slide_pad_wrap.appendChild(create_feed_source_element(entry));
  slide.appendChild(slide_pad_wrap);

  Slideshow.append(slide);
}

function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', entry_peek_url(entry));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    let safe_title = html_escape(title);

    // Set the attribute value to the full title without truncation or publisher
    // filter BUG: this is double encoding entities somehow, so entities show up
    // in the value
    title_element.setAttribute('title', safe_title);

    let filtered_safe_title = filter_title_publisher(safe_title);
    try {
      filtered_safe_title = html_truncate(filtered_safe_title, 300);
    } catch (error) {
      console.warn(error);
    }

    // Use innerHTML to allow entities in titles
    title_element.innerHTML = filtered_safe_title;

  } else {
    title_element.setAttribute('title', 'Untitled');
    title_element.textContent = 'Untitled';
  }

  return title_element;
}

function create_article_content_element(entry) {
  const content_element = document.createElement('span');
  content_element.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  content_element.innerHTML = entry.content;
  return content_element;
}

function create_feed_source_element(entry) {
  const source_element = document.createElement('span');
  source_element.setAttribute('class', 'entry-source');

  // At this point, assume that if faviconURLString is set, that it is
  // valid (defined, a string, a well-formed canonical url string). If it is not
  // valid by this point then something is really wrong elsewhere in the app,
  // but that is not our concern here. If the url is bad then show a broken
  // image.
  if (entry.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', entry.faviconURLString);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    source_element.appendChild(favicon_element);
  }

  const details = document.createElement('span');
  if (entry.feedLink) {
    details.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if (entry.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.datePublished));
  }
  details.textContent = buffer.join('');
  source_element.appendChild(details);
  return source_element;
}

// TODO: move this back to a helper file, it is too detailed and I dislike how
// huge this file has become
// TODO: support alternate whitespace expressions around delimiters
// Filter publisher information from an article title
// @param title {String} the title of an web page
// @returns {String} the title without publisher information
function filter_title_publisher(title) {
  if (typeof title !== 'string') {
    console.error('Invalid title parameter', title);
  }

  // Look for a delimiter
  let delimiter_position = title.lastIndexOf(' - ');
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' | ');
  }
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' : ');
  }

  // Exit early if no delimiter found
  if (delimiter_position < 0) {
    return title;
  }

  // Exit early if the delimiter did not occur late enough in the title
  const MIN_TITLE_LENGTH = 20;
  if (delimiter_position < MIN_TITLE_LENGTH) {
    return title;
  }

  // Exit early if the delimiter was found too close to the end
  const MIN_PUBLISHER_NAME_LENGTH = 5;
  const remaining_char_count = title.length - delimiter_position;
  if (remaining_char_count < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  // Break apart the tail into words
  const delimiter_length = 3;
  const tail = title.substring(delimiter_position + delimiter_length);
  const words = tokenize(tail);

  // If there are too many words, return the full title, because tail is
  // probably not a publisher
  const MAX_TAIL_WORDS = 4;
  if (words.length > MAX_TAIL_WORDS) {
    return title;
  }

  return title.substring(0, delimiter_position).trim();
}

// Helper for filter_title_publisher, break apart string into array of words
function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens by trimming and checking length
    const trimmed_input = value.trim();
    if (trimmed_input.length) {
      return trimmed_input.split(/\s+/g);
    }
  }
  return [];
}

async function slide_onclick(event) {
  // We only care about responding to left click
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  // event.target is the clicked element, which could be an anchor, an element
  // that is a descendant of an anchor, or some other element in the slide.
  // Search for the containing anchor (which includes testing against the
  // clicked element itself)
  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  if (!anchor.hasAttribute('href')) {
    return true;
  }

  // We've determined at this point we are going to handle the click. Inform the
  // browser that we are intercepting.
  event.preventDefault();

  // Open the url in a new tab.
  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return;
  }

  tab_open(url_string);

  // Find the slide that was clicked
  const clicked_slide = anchor.parentNode.closest('slide');
  if (!clicked_slide) {
    return;
  }

  const current_slide = Slideshow.getCurrentSlide();

  if (clicked_slide.hasAttribute('stale')) {
    return false;
  }

  // TODO: this belongs in a helper in ral.js. The problem however is that I
  // split up the functionality, this uses the element, I cannot use the element
  // in ral. So really the problem is that slide_mark_read does too much. This
  // should be able to use only those components of slide_mark_read that it
  // cares about. But in order to break up slide_mark_read appropriately, I
  // think I need to refactor how the element is updated after click, I think it
  // needs to be done from message event handler instead of explicitly done, so
  // that it no longer matters which initiator started the sequence

  // Mark the current slide as read
  let conn;
  try {
    conn = await reader_db_open();
  } catch (error) {
    // TODO: visually show error
    console.error(error);
    return false;
  }

  await slide_mark_read(conn, clicked_slide);

  conn.close();
}

// TODO: is the debouncing stuff with idle callback approach needed??
// TODO: do not handle key press if target is input/textarea
let keydown_timer_id = null;
function on_key_down(event) {
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  switch (code) {
    case RIGHT:
    case N:
    case SPACE: {
      event.preventDefault();
      cancelIdleCallback(keydown_timer_id);
      keydown_timer_id = requestIdleCallback(slide_next);
      break;
    }

    case LEFT:
    case P: {
      event.preventDefault();
      cancelIdleCallback(keydown_timer_id);
      keydown_timer_id = requestIdleCallback(Slideshow.prev);
      break;
    }
  }
}

window.addEventListener('keydown', on_key_down);

// TODO: I should probably unlink loading on demand and navigation, because this
// causes lag. navigation would be smoother if I appended even earlier, like
// before even reaching the situation of its the last slide and there are no
// more so append. It would be better if I did something like check the number
// of remaining unread slides, and if that is less than some number, append
// more. And it would be better if I did that before even navigating. However
// that would cause lag. So it would be even better if I started in a separate
// microtask an append operation and then continued in the current task. Or, the
// check should happen not on append, but after doing the navigation. Or after
// marking the slide as read.

// TODO: sharing the connection between mark as read and
// slide_load_and_append_multiple made sense at first but I do not like the
// large try/catch block. Also I think the two can be unlinked because they do
// not have to co-occur. Also I don't like how it has to wait for read to
// complete.

async function slide_next() {
  const current_slide = Slideshow.getCurrentSlide();

  // If there are still unread articles return. Do not mark the current article,
  // if it exists, as read.
  const slide_unread_count = slideshow_count_unread();
  // We still append if there is just one unread slide
  if (slide_unread_count > 1) {
    console.debug(
        'Not dynamically appending because %d unread slides remain',
        slide_unread_count);

    // TODO: like the notes in the click handler, this should be calling to a
    // helper in ral.js that deals with conn open and close

    // Mark the current slide as read
    let conn;
    try {
      conn = await reader_db_open();
    } catch (error) {
      console.error(error);
      return;
    }

    await slide_mark_read(conn, current_slide);
    conn.close();

    Slideshow.next();
    return;
  }

  let appendCount = 0;
  let conn;
  try {
    conn = await reader_db_open();
  } catch (error) {
    console.error(error);
    return;
  }

  if (slide_unread_count < 2) {
    console.log('Appending additional slides prior to navigation');
    appendCount = await slide_load_and_append_multiple(conn);
  } else {
    console.log('Not appending additional slides prior to navigation');
  }

  Slideshow.next();
  await slide_mark_read(conn, current_slide);
  conn.close();

  if (appendCount < 1) {
    return;
  }

  const maxLoadCount = 6;
  let firstSlide = Slideshow.getFirstSlide();
  while (Slideshow.count() > maxLoadCount && firstSlide !== current_slide) {
    Slideshow.remove(firstSlide);
    firstSlide.removeEventListener('click', slide_onclick);
    firstSlide = Slideshow.getFirstSlide();
  }
}

function slideshow_count_unread() {
  return Slideshow.getSlides()
      .filter(slide => !slide.hasAttribute('read'))
      .length;
}

let refresh_in_progress = false;
async function refresh_anchor_onclick(event) {
  event.preventDefault();
  console.log('Clicked refresh button');

  if (refresh_in_progress) {
    console.log('Ignoring refresh button click while refresh in progress');
    return;
  }
  refresh_in_progress = true;

  // TODO: this approach leaks default channel in poll_service_create_context

  let ctx;
  try {
    ctx = await poll_service_create_context();
    ctx.ignoreRecencyCheck = true;
    ctx.ignoreModifiedCheck = true;
    ctx.console = console;
    ctx.channel = channel;
    await poll_service_poll_feeds(ctx);

  } catch (error) {
    // TODO: show an error message
    console.error(error);
  } finally {
    if (ctx.feedConn) {
      ctx.feedConn.close();
    }

    if (ctx.iconConn) {
      ctx.iconConn.close();
    }

    // keep channel open, it has persistent lifetime
  }

  console.log('Re-enabling refresh button');
  refresh_in_progress = false;  // Always renable
}

function options_menu_show() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '0px';
  menuOptions.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

function options_menu_hide() {
  const menuOptions = document.getElementById('left-panel');
  menuOptions.style.marginLeft = '-320px';
  menuOptions.style.boxShadow = '';  // HACK
}

function main_menu_button_onclick(event) {
  const menuOptions = document.getElementById('left-panel');
  if (menuOptions.style.marginLeft === '0px') {
    options_menu_hide();
  } else if (menuOptions.style.marginLeft === '') {
    options_menu_show();
  } else {
    options_menu_show();
  }
}

function options_menu_onclick(event) {
  // event.target points to either a clicked <li> or the <ul>
  const option = event.target;

  // Ignore clicks on elements that are not menu options
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      console.warn('Not yet implemented');
      break;
    case 'menu-option-import':
      import_menu_option_handle_click(event);
      break;
    case 'menu-option-export':
      export_menu_option_handle_click(event);
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

function import_menu_option_handle_click(event) {
  const uploaderInput = document.createElement('input');
  uploaderInput.setAttribute('type', 'file');
  uploaderInput.setAttribute('accept', 'text/xml');
  uploaderInput.onchange = function importInputOnchange(event) {
    importFiles(uploaderInput.files).catch(console.warn);
  };
  uploaderInput.click();
}

async function importFiles(files) {
  // TODO: show operation started

  try {
    await ral_import(channel, files);
  } catch (error) {
    // TODO: visual feedback in event an error
    console.error(error);
    return;
  }

  console.log('Import completed');

  // TODO: visually inform the user that the operation completed successfully
  // TODO: refresh feed list
  // TODO: switch to feed list section?
}

async function export_menu_option_handle_click(event) {
  const title = 'Subscriptions', filename = 'subscriptions.xml';
  let blob;
  try {
    blob = await ral_export(title);
  } catch (error) {
    // TODO: show an error message
    console.error(error);
    return;
  }

  downloadBlob(blob, filename);
  // TODO: visual feedback on completion
  console.log('Export completed');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', filename);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorMessageContainerOnclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}

function noop() {}

function windowOnclick(event) {
  // TODO: am I still using marginLeft? I thought I switched to left?

  // If the click occurred outside of the menu options panel, hide the menu
  // options panel
  const avoidedZoneIds = ['main-menu-button', 'left-panel'];
  if (!avoidedZoneIds.includes(event.target.id) &&
      !event.target.closest('[id="left-panel"]')) {
    // Hide only if not hidden. marginLeft is only 0px in visible state. If
    // marginLeft is empty string or -320px then menu already hidden
    const aside = document.getElementById('left-panel');
    if (aside.style.marginLeft === '0px') {
      options_menu_hide();
    }
  }

  return true;
}

function feedsContainerOnclick(event) {
  if (event.target.localName !== 'div') {
    return true;
  }

  if (!event.target.id) {
    return true;
  }

  toggleFeedContainerDetails(event.target);
}

function toggleFeedContainerDetails(feedElement) {
  const table = feedElement.querySelector('table');

  if (feedElement.hasAttribute('expanded')) {
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
  for (const feed of feeds) {
    appendFeed(feed);
  }
}

function unsubscribeButtonOnclick(event) {
  console.debug('Unsubscribe', event.target);
}

// TODO: create helper function createFeedElement that then is passed to this,
// rename this to appendFeedElement and change its parameter
function appendFeed(feed) {
  const feedsContainer = document.getElementById('feeds-container');
  const feedElement = document.createElement('div');
  feedElement.id = feed.id;

  if (feed.active !== true) {
    feedElement.setAttribute('inactive', 'true');
  }

  let title_element = document.createElement('span');
  title_element.textContent = feed.title;
  feedElement.appendChild(title_element);

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
  col.textContent = feed_peek_url(feed);
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
  if (feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);

  button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribeButtonOnclick;
  button.textContent = 'Deactivate';
  if (!feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);


  row.appendChild(col);
  feedInfoElement.appendChild(row);

  feedElement.appendChild(feedInfoElement);

  if (feedsContainer) {
    feedsContainer.appendChild(feedElement);
  }
}

function formatDate(date, delimiter) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // TODO: move this to github issue
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

  // var d = new Date('Tue 13 Dec 2011 09:37:46 AM ART'); d.getTime() ===
  // d.getTime(); => false So basically all the date parsing needs to be
  // refactored. Not sure I even need the try/catches.

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
  } catch (error) {
    console.debug(error);
    return 'Invalid date';
  }
}

function tab_open(url) {
  chrome.tabs.create({active: true, url: url});
}

function headerFontMenuOnchange(event) {
  console.debug('Header font menu change event', event);
  const fontName = event.target.value;
  if (fontName) {
    localStorage.HEADER_FONT_FAMILY = fontName;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  PageStyle.pageStyleSettingsOnchange();
}

function bodyFontMenuOnchange(event) {
  console.debug('Body font menu change event', event);
  const fontName = event.target.value;
  if (fontName) {
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
  for (const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if (fontName === currentHeaderFont) {
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
  for (const fontName of fonts) {
    const option = document.createElement('option');
    option.value = fontName;
    option.textContent = fontName;
    if (fontName === currentBodyFont) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

async function initSlideshowPage() {
  loading_info_show();

  window.addEventListener('click', windowOnclick);

  const mainMenuButton = document.getElementById('main-menu-button');
  mainMenuButton.onclick = main_menu_button_onclick;

  // Initialize the refresh icon in the header
  const refreshButton = document.getElementById('refresh');
  refreshButton.onclick = refresh_anchor_onclick;

  const feedsButton = document.getElementById('feeds-button');
  feedsButton.onclick = feedsButtonOnclick;

  const readerButton = document.getElementById('reader-button');
  readerButton.onclick = readerButtonOnclick;

  // Initialize error message container
  const errorContainer = document.getElementById('error-message-container');
  if (errorContainer) {
    errorContainer.onclick = errorMessageContainerOnclick;
  }

  const feedsContainer = document.getElementById('feeds-container');
  if (feedsContainer) {
    feedsContainer.onclick = feedsContainerOnclick;
  }

  const menuOptions = document.getElementById('left-panel');
  menuOptions.onclick = options_menu_onclick;

  initHeaderFontMenu();
  initBodyFontMenu();

  // TODO: is it possible to defer this until after loading without slowing
  // things down? Initialize entry display settings
  PageStyle.pageStyleSettingsOnload();

  // TODO: closing should happen before append actually takes place, there is no
  // need to keep the database open longer.
  // TODO: create a helper function that encapsulates this

  // Load and append slides
  const initialLimit = 1;
  let didHideLoading = false;

  let conn;
  try {
    conn = await reader_db_open();
  } catch (error) {
    // TODO: visually show error message
    console.error(error);
    loading_info_hide();
    return;
  }

  // First load only 1, to load quickly
  await slide_load_and_append_multiple(conn, initialLimit);
  console.log('Initial slide loaded');

  loading_info_hide();

  // Now preload a couple more
  await slide_load_and_append_multiple(conn, 2);

  let feeds;
  try {
    feeds = await reader_db_get_feeds(conn);
  } catch (error) {
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
