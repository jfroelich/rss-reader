import {html_escape, html_truncate} from '/src/html/html.js';
import entry_mark_read from '/src/feed-ops/mark-entry-read.js';
import {ral_export, ral_import, ral_load_initial, ral_poll_feeds} from '/src/ral.js';
import {entry_is_valid_id, entry_peek_url, feed_peek_url, rdb_find_viewable_entries, rdb_get_feeds, rdb_is_entry, rdb_open} from '/src/rdb.js';
import {filter_title_publisher} from '/src/views/article-utils.js';
import {date_format} from '/src/views/date.js';
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
      PageStyle.page_style_onchange(message);
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
    conn = await rdb_open();
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
  const slide_element_name = Slideshow.element_get_name();
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
  if (Slideshow.slide_is_current(slide)) {
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
  if (slide_element.hasAttribute('stale')) {
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

  // TEMP: overly paranoid assertion of conn given that internals of
  // entry_mark_read can no longer rely on dynamic auto-connect
  if (!(conn instanceof IDBDatabase)) {
    console.error('Invalid database connection');
    return;
  }

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
    entries = await rdb_find_viewable_entries(conn, offset, limit);
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
  if (!rdb_is_entry(entry)) {
    console.error('Invalid entry parameter', entry);
    return;
  }

  console.debug('Appending entry', entry_peek_url(entry));

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
    buffer.push(date_format(entry.datePublished));
  }
  details.textContent = buffer.join('');
  source_element.appendChild(details);
  return source_element;
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

  const current_slide = Slideshow.get_current_slide();

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
    conn = await rdb_open();
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
  const current_slide = Slideshow.get_current_slide();

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
      conn = await rdb_open();
    } catch (error) {
      console.error(error);
      return;
    }

    await slide_mark_read(conn, current_slide);
    conn.close();

    Slideshow.next();
    return;
  }

  let append_count = 0;
  let conn;
  try {
    conn = await rdb_open();
  } catch (error) {
    console.error(error);
    return;
  }

  if (slide_unread_count < 2) {
    console.log('Appending additional slides prior to navigation');
    append_count = await slide_load_and_append_multiple(conn);
  } else {
    console.log('Not appending additional slides prior to navigation');
  }

  Slideshow.next();
  await slide_mark_read(conn, current_slide);
  conn.close();

  if (append_count < 1) {
    return;
  }

  const maxLoadCount = 6;
  let firstSlide = Slideshow.slide_get_first();
  while (Slideshow.count() > maxLoadCount && firstSlide !== current_slide) {
    Slideshow.remove(firstSlide);
    firstSlide.removeEventListener('click', slide_onclick);
    firstSlide = Slideshow.slide_get_first();
  }
}

function slideshow_count_unread() {
  const slides = Slideshow.slide_get_all();
  const unread_slides =
      Array.prototype.filter.call(slides, slide => !slide.hasAttribute('read'));
  return unread_slides.length;
}

let refresh_in_progress = false;
function refresh_anchor_onclick(event) {
  event.preventDefault();
  if (refresh_in_progress) {
    return;
  }
  refresh_in_progress = true;

  ral_poll_feeds(channel, console)
      .then(
          _ => {
              // TODO: show a completed message?
          })
      .catch(error => {
        // TODO: show an error message
        console.error(error);
      })
      .finally(_ => refresh_in_progress = false);
}

function options_menu_show() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '0px';
  menu_options.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

function options_menu_hide() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '-320px';
  menu_options.style.boxShadow = '';  // HACK
}

function main_menu_button_onclick(event) {
  const menu_options = document.getElementById('left-panel');
  if (menu_options.style.marginLeft === '0px') {
    options_menu_hide();
  } else if (menu_options.style.marginLeft === '') {
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
  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'text/xml');
  uploader_input.onchange = uploader_input_onchange;
  uploader_input.click();
}

function uploader_input_onchange(event) {
  const files = event.target.files;
  if (!files) {
    console.error('No files', event);
    return;
  }

  // TODO: show operation started

  ral_import(channel, files)
      .then(() => {
        console.log('Import completed');

        // TODO: visually inform the user that the operation completed
        // successfully
        // TODO: refresh feed list so that it displays any new feeds
        // TODO: switch to feed list section or at least show a message about
        // how the import completed successfully, and perhaps other details such
        // as the number of subscriptions added
      })
      .catch(error => {
        // TODO: show a friendly error message
        console.error(error);
      });
}

function export_menu_option_handle_click(event) {
  const title = 'Subscriptions';
  ral_export(title)
      .then(blob => {
        const filename = 'subscriptions.xml';
        download_blob(blob, filename);
        // TODO: visual feedback on completion
        console.log('Export completed');
      })
      .catch(error => {
        // TODO: show an error message
        console.error(error);
      });
}

function download_blob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', filename);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

function error_message_container_onclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}

function noop() {}

function window_onclick(event) {
  // TODO: am I still using marginLeft? I thought I switched to left?

  // If the click occurred outside of the menu options panel, hide the menu
  // options panel
  const avoided_zone_ids = ['main-menu-button', 'left-panel'];
  if (!avoided_zone_ids.includes(event.target.id) &&
      !event.target.closest('[id="left-panel"]')) {
    // Hide only if not hidden. marginLeft is only 0px in visible state. If
    // marginLeft is empty string or -320px then menu already hidden
    const left_panel_element = document.getElementById('left-panel');
    if (left_panel_element.style.marginLeft === '0px') {
      options_menu_hide();
    }
  }

  return true;
}

function feeds_container_onclick(event) {
  if (event.target.localName !== 'div') {
    return true;
  }

  if (!event.target.id) {
    return true;
  }

  feed_container_toggle_details(event.target);
}

function feed_container_toggle_details(feed_element) {
  const table = feed_element.querySelector('table');

  if (feed_element.hasAttribute('expanded')) {
    // Collapse
    feed_element.removeAttribute('expanded');
    feed_element.style.width = '200px';
    feed_element.style.height = '200px';
    feed_element.style.cursor = 'zoom-in';
    table.style.display = 'none';
  } else {
    // Expand
    feed_element.setAttribute('expanded', 'true');
    feed_element.style.width = '100%';
    feed_element.style.height = 'auto';
    feed_element.style.cursor = 'zoom-out';
    table.style.display = 'block';
  }
}

function feeds_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = true;
  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = false;
  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'none';
  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'block';
}

function reader_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = false;
  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = true;
  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'block';
  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'none';
}

function unsubscribe_button_onclick(event) {
  console.debug('Unsubscribe (not yet implemented)', event.target);
}

// TODO: create helper function createFeedElement that then is passed to this,
// rename this to appendFeedElement and change its parameter
function feeds_container_append_feed(feed) {
  console.debug('Appending feed', feed_peek_url(feed));

  const feeds_container = document.getElementById('feeds-container');
  const feed_element = document.createElement('div');
  feed_element.id = feed.id;

  if (feed.active !== true) {
    feed_element.setAttribute('inactive', 'true');
  }

  const title_element = document.createElement('span');
  title_element.textContent = feed.title;
  feed_element.appendChild(title_element);

  const feed_info_element = document.createElement('table');

  let row = document.createElement('tr');
  let col = document.createElement('td');
  col.textContent = 'Description';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.description || 'No description';
  row.appendChild(col);
  feed_info_element.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Webpage';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.link || 'Not specified';
  row.appendChild(col);
  feed_info_element.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Favicon';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed.faviconURLString || 'Unknown';
  row.appendChild(col);
  feed_info_element.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'URL';
  row.appendChild(col);
  col = document.createElement('td');
  col.textContent = feed_peek_url(feed);
  row.appendChild(col);
  feed_info_element.appendChild(row);

  row = document.createElement('tr');
  col = document.createElement('td');
  col.setAttribute('colspan', '2');

  let button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribe_button_onclick;
  button.textContent = 'Unsubscribe';
  col.appendChild(button);

  button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribe_button_onclick;
  button.textContent = 'Activate';
  if (feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);

  button = document.createElement('button');
  button.value = '' + feed.id;
  button.onclick = unsubscribe_button_onclick;
  button.textContent = 'Deactivate';
  if (!feed.active) {
    button.disabled = 'true';
  }
  col.appendChild(button);

  row.appendChild(col);
  feed_info_element.appendChild(row);
  feed_element.appendChild(feed_info_element);

  // TODO: this needs to find the proper place to append the feed
  // using feed_compare. This needs to iterate over the existing feeds and
  // compare each one to the feed and find where to insert, and fall back to
  // append. I no longer am pre-sorting an array and then iterating over it,
  // I am using a callback that loads feeds from the db in natural order.
  feeds_container.appendChild(feed_element);
}

function feed_compare(a, b) {
  const atitle = a.title ? a.title.toLowerCase() : '';
  const btitle = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(atitle, btitle);
}

function tab_open(url) {
  chrome.tabs.create({active: true, url: url});
}

function header_font_menu_onchange(event) {
  const font_name = event.target.value;
  if (font_name) {
    localStorage.HEADER_FONT_FAMILY = font_name;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  PageStyle.page_style_onchange();
}

function body_font_menu_onchange(event) {
  const font_name = event.target.value;
  if (font_name) {
    localStorage.BODY_FONT_FAMILY = font_name;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  PageStyle.page_style_onchange();
}

function header_font_menu_init() {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = localStorage.HEADER_FONT_FAMILY;
  const default_option = document.createElement('option');
  default_option.value = '';
  default_option.textContent = 'Header Font';
  menu.appendChild(default_option);
  for (const font_name of fonts) {
    const option = document.createElement('option');
    option.value = font_name;
    option.textContent = font_name;
    if (font_name === current_header_font) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

function body_font_menu_init() {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = body_font_menu_onchange;
  const current_body_font = localStorage.BODY_FONT_FAMILY;
  const default_option = document.createElement('option');
  default_option.value = '';
  default_option.textContent = 'Body Font';
  menu.appendChild(default_option);
  for (const font_name of fonts) {
    const option = document.createElement('option');
    option.value = font_name;
    option.textContent = font_name;
    if (font_name === current_body_font) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

function slideshow_page_init() {
  loading_info_show();

  window.addEventListener('click', window_onclick);

  const main_menu_button = document.getElementById('main-menu-button');
  main_menu_button.onclick = main_menu_button_onclick;

  // Initialize the refresh icon in the header
  const refresh_button = document.getElementById('refresh');
  refresh_button.onclick = refresh_anchor_onclick;

  const feeds_button = document.getElementById('feeds-button');
  feeds_button.onclick = feeds_button_onclick;

  const reader_button = document.getElementById('reader-button');
  reader_button.onclick = reader_button_onclick;

  // Initialize error message container
  const error_container = document.getElementById('error-message-container');
  if (error_container) {
    error_container.onclick = error_message_container_onclick;
  }

  const feeds_container = document.getElementById('feeds-container');
  if (feeds_container) {
    feeds_container.onclick = feeds_container_onclick;
  }

  const menu_options = document.getElementById('left-panel');
  menu_options.onclick = options_menu_onclick;

  header_font_menu_init();
  body_font_menu_init();

  PageStyle.page_style_onload();

  const entry_cursor_offset = 0, entry_cursor_limit = 6;
  ral_load_initial(
      entry_cursor_offset, entry_cursor_limit, slide_append,
      feeds_container_append_feed)
      .then(loading_info_hide)
      .catch((error) => {
        // TODO: show an error message
        console.error(error);
      });
}

slideshow_page_init();
