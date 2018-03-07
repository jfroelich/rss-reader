import {date_format} from '/src/date/date.js';
import entry_mark_read from '/src/feed-ops/mark-entry-read.js';
import {html_truncate} from '/src/html-truncate/html-truncate.js';
import {html_escape} from '/src/html/html.js';
import {ral_export, ral_import, ral_load_initial, ral_poll_feeds} from '/src/ral/ral.js';
import * as rdb from '/src/rdb/rdb.js';
import * as PageStyle from '/src/slideshow-page/page-style-settings.js';
import * as Slideshow from '/src/slideshow-page/slideshow.js';
import {filter_publisher} from '/src/filter-publisher/filter-publisher.js';

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

async function on_entry_added_message(message) {
  if (slideshow_count_unread() <= 3) {
    let conn;
    try {
      conn = await rdb.rdb_open();
      await slide_load_and_append_multiple(conn);
    } finally {
      if (conn) {
        conn.close();
      }
    }
  }
}

async function on_entry_expired_message(message) {
  if (typeof message === 'object' && rdb.rdb_entry_is_valid_id(message.id)) {
    const slide_name = Slideshow.element_get_name();
    const selector = slide_name + '[entry="' + message.id + '"]';
    const slide = document.querySelector(selector);
    if (slide) {
      if (Slideshow.slide_is_current(slide)) {
        slide.setAttribute('stale', 'true');
        return;
      }

      Slideshow.remove(slide);
      slide.removeEventListener('click', slide_onclick);
    }
  }
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
  loading_info_element.style.display = 'none';
}

// TODO: this should not need to be async and await. However, right now when it
// does not wait the call to update badge unread count fails because the
// subsequent conn.close call occurs too early
async function slide_mark_read(conn, slide) {
  if (!slide.hasAttribute('read') && !slide.hasAttribute('stale')) {
    const id = parseInt(slide.getAttribute('entry'), 10);
    console.log('Marking slide with entry id %d as read', id);
    await entry_mark_read(conn, channel, id);
    slide.setAttribute('read', '');
  }
}

function error_message_show(message_text) {
  const container = document.getElementById('error-message-container');
  container.textContent = message_text;
  container.style.display = 'block';
}

async function slide_load_and_append_multiple(conn, limit) {
  limit = typeof limit === 'undefined' ? 3 : limit;
  console.log('Appending slides (limit: %d)', limit);
  const offset = slideshow_count_unread();

  let entries;
  try {
    entries = await rdb.rdb_find_viewable_entries(conn, offset, limit);
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

function slide_append(entry) {
  if (!rdb.rdb_is_entry(entry)) {
    console.error('Invalid entry parameter', entry);
    return;
  }

  console.debug('Appending entry', rdb.rdb_entry_peek_url(entry));

  const slide = Slideshow.create();
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');
  slide.addEventListener('click', slide_onclick);

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
  title_element.setAttribute('href', rdb.rdb_entry_peek_url(entry));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    let safe_title = html_escape(title);

    // Set the attribute value to the full title without truncation or publisher
    // filter
    title_element.setAttribute('title', safe_title);

    let filtered_safe_title = filter_publisher(safe_title);
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
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  if (!anchor.hasAttribute('href')) {
    return true;
  }

  event.preventDefault();

  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return;
  }

  tab_open(url_string);

  const clicked_slide = anchor.parentNode.closest('slide');
  if (!clicked_slide) {
    return;
  }

  const current_slide = Slideshow.get_current_slide();

  if (clicked_slide.hasAttribute('stale')) {
    return false;
  }

  let conn;
  try {
    conn = await rdb.rdb_open();
  } catch (error) {
    // TODO: visually show error
    console.error(error);
    return false;
  }

  await slide_mark_read(conn, clicked_slide);

  conn.close();
}

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

async function slide_next() {
  const current_slide = Slideshow.get_current_slide();
  const slide_unread_count = slideshow_count_unread();

  if (slide_unread_count > 1) {
    let conn;
    try {
      conn = await rdb.rdb_open();
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
    conn = await rdb.rdb_open();
  } catch (error) {
    console.error(error);
    return;
  }

  if (slide_unread_count < 2) {
    append_count = await slide_load_and_append_multiple(conn);
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
  if (!refresh_in_progress) {
    refresh_in_progress = true;
    ral_poll_feeds(channel, console)
        .then(_ => {})
        .catch(error => {
          console.error(error);
        })
        .finally(_ => refresh_in_progress = false);
  }
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
  const option = event.target;
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
      break;
    case 'menu-option-body-font':
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

  ral_import(channel, files)
      .then(() => {
        console.log('Import completed');
      })
      .catch(error => {
        console.error(error);
      });
}

function export_menu_option_handle_click(event) {
  const title = 'Subscriptions';
  ral_export(title)
      .then(blob => {
        const filename = 'subscriptions.xml';
        download_blob(blob, filename);
        console.log('Export completed');
      })
      .catch(error => {
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
  const avoided_zone_ids = ['main-menu-button', 'left-panel'];
  if (!avoided_zone_ids.includes(event.target.id) &&
      !event.target.closest('[id="left-panel"]')) {
    const left_panel_element = document.getElementById('left-panel');
    if (left_panel_element.style.marginLeft === '0px') {
      options_menu_hide();
    }
  }

  return true;
}

function feeds_container_onclick(event) {
  if (event.target.localName === 'div' && event.target.id) {
    feed_container_toggle_details(event.target);
  }
}

function feed_container_toggle_details(feed_element) {
  const table = feed_element.querySelector('table');
  if (feed_element.hasAttribute('expanded')) {
    feed_element.removeAttribute('expanded');
    feed_element.style.width = '200px';
    feed_element.style.height = '200px';
    feed_element.style.cursor = 'zoom-in';
    table.style.display = 'none';
  } else {
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

function feeds_container_append_feed(feed) {
  // console.debug('Appending feed', rdb.rdb_feed_peek_url(feed));
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
  col.textContent = rdb.rdb_feed_peek_url(feed);
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
  const refresh_button = document.getElementById('refresh');
  refresh_button.onclick = refresh_anchor_onclick;
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.onclick = feeds_button_onclick;
  const reader_button = document.getElementById('reader-button');
  reader_button.onclick = reader_button_onclick;
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
        console.error(error);
      });
}

slideshow_page_init();
