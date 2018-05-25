import '/src/cli.js';

import {config_channel_name, config_fonts} from '/src/config.js';
import {db_find_viewable_entries} from '/src/db/db-find-viewable-entries.js';
import {db_for_each_active_feed} from '/src/db/db-for-each-active-feed.js';
import {db_for_each_viewable_entry} from '/src/db/db-for-each-viewable-entry.js';
import {db_mark_entry_read} from '/src/db/db-mark-entry-read.js';
import {db_open} from '/src/db/db-open.js';
import {is_entry, is_valid_entry_id} from '/src/entry.js';
import {favicon_create_conn} from '/src/favicon.js';
import {import_opml} from '/src/import-opml.js';
import {console_stub} from '/src/lib/console-stub.js';
import {date_format} from '/src/lib/date.js';
import {filter_publisher} from '/src/lib/filter-publisher.js';
import {html_truncate} from '/src/lib/html-truncate.js';
import {html_escape} from '/src/lib/html.js';
import {list_peek} from '/src/lib/list.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {slideshow_export_opml} from '/src/slideshow-page/export-opml.js';
import * as page_style from '/src/slideshow-page/page-style-settings.js';
import * as Slideshow from '/src/slideshow-page/slideshow.js';

// TODO: better support of browser back/forward buttons
// TODO: navigation occassionally pauses. This shouldn't happen. Should
// immediately navigate to something like an empty div, show a 'loading'
// message, then load, then hide the loading message.
// TODO: similar to the manner in which I structured the db folder, I would
// prefer I break up this very large module into smaller coordinating modules.
// This has grown large enough and incoherent enough that it is slightly
// unweildy.


// Declare a page-lifetime channel that will listen for messages so long as the
// page is open.
const channel = new BroadcastChannel(config_channel_name);

channel.onmessage = function channel_onmessage(event) {
  if (!event.isTrusted) {
    console.warn('Untrusted event', event);
    return;
  }

  const message = event.data;
  if (!message) {
    console.warn('Invalid message', event);
    return;
  }

  switch (message.type) {
    case 'display-settings-changed':
      console.debug('Updating article style');
      page_style.page_style_onchange(message);
      break;
    case 'entry-write':
      on_entry_write_message(message).catch(console.warn);
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
      on_entry_marked_read_message(message).catch(console.warn);
      break;
    case 'feed-written':
      // NOTE: this also happens when feed activated/deactivated, the message
      // will have a property 'property' with the value 'active'
      // TODO: just realized, no way to tell whether active or inactive as a
      // result
      // console.debug('%s: feed written %o', channel_onmessage.name, message);
      break;
    default:
      console.warn('Unknown message type', message);
      break;
  }
};

channel.onmessageerror = function channel_onmessageerror(event) {
  console.error(
      '%s: could not deserialize message from channel',
      channel_onmessageerror.name, event);
};

async function on_entry_write_message(message) {
  if (!message.create) {
    // TEMP: debugging some functionality in flux
    console.debug('Ignoring entry-write message', message);
    return;
  }

  const unread_count = slideshow_count_unread();
  if (unread_count <= 3) {
    const conn = await db_open();
    await slide_load_and_append_multiple(conn);
    conn.close();
  }
}

async function on_entry_expired_message(message) {
  // Weak assertions simply to help debug in event of programmer error
  console.assert(typeof message === 'object');
  console.assert(is_valid_entry_id(message.id));

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

// TODO: eventually this should call some helper like find_slide_by_entry_id
// from slideshow.js but for now implement it locally
// TODO: this should interact with slideshow.js constant for element name
// instead of hardcoding it here.
async function on_entry_marked_read_message(message) {
  // Weak assertions to help debug, generally should never trigger
  console.assert(typeof message === 'object');
  console.assert(is_valid_entry_id(message.id));

  const selector = 'slide[entry="' + message.id + '"]';
  const slide = document.querySelector(selector);

  // The slide may no longer exist, or the id may not correspond
  if (!slide) {
    console.warn(
        '%s: could not find slide for id %d', on_entry_marked_read_message.name,
        message.id);
    return;
  }

  slide.setAttribute('read', '');
}

function loading_info_show() {
  const element = document.getElementById('initial-loading-panel');
  console.assert(element);
  element.style.display = 'block';
}

function loading_info_hide() {
  const element = document.getElementById('initial-loading-panel');
  console.assert(element);
  element.style.display = 'none';
}

// This uses a short-lived local channel instance instead of the page-lifetime
// channel because there is a no-loopback issue with channels in Chrome. That
// or I don't understand how channels operate.
// TODO: if this creates its own conn instead of trying to reuse, then could it
// run unawaited? Or was it the channel that was causing the issue and now
// irrelevant because this now uses local channel instance?
async function slide_mark_read(conn, slide) {
  console.assert(conn instanceof IDBDatabase);
  console.assert(slide);

  if (slide.hasAttribute('read') || slide.hasAttribute('stale')) {
    console.debug('%s: ignoring stale/read slide', slide_mark_read.name, slide);
    return;
  }

  const id = parseInt(slide.getAttribute('entry'), 10);
  const op = {};
  op.conn = conn;
  op.channel = new BroadcastChannel(config_channel_name);
  op.console = console_stub;
  op.db_mark_entry_read = db_mark_entry_read;
  await op.db_mark_entry_read(id);
  op.channel.close();
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

  let entries = await db_find_viewable_entries(conn, offset, limit);

  for (const entry of entries) {
    slide_append(entry);
  }

  return entries.length;
}

function slide_append(entry) {
  if (!is_entry(entry)) {
    console.error('%s: invalid entry parameter', slide_append.name, entry);
    return;
  }

  console.debug('%s: entry', slide_append.name, list_peek(entry.urls));

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
  title_element.setAttribute('href', list_peek(entry.urls));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    let safe_title = html_escape(title);
    title_element.setAttribute('title', safe_title);

    let filtered_safe_title = filter_publisher(safe_title);

    // TODO: does html_truncate throw in the usual case? I believe it should not
    // but I forgot. I would like to remove this try/catch
    try {
      filtered_safe_title = html_truncate(filtered_safe_title, 300);
    } catch (error) {
      console.warn(error);
    }

    // Allow entities
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
  // <html><body> is implicitly stripped
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

  const conn = await db_open();
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
    const conn = await db_open();
    await slide_mark_read(conn, current_slide);
    conn.close();
    Slideshow.next();
    return;
  }

  let append_count = 0;
  const conn = await db_open();

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
async function refresh_anchor_onclick(event) {
  event.preventDefault();

  if (refresh_in_progress) {
    return;
  }

  refresh_in_progress = true;

  // Create a local channel object because apparently a channel cannot notify
  // itself (at least in Chrome 66) despite what spec states
  const onclick_channel = new BroadcastChannel(config_channel_name);

  const rconn = await db_open();
  const iconn = await favicon_create_conn();

  const options = {};
  options.ignore_recency_check = true;

  // NOTE: temporarily enable console during dev
  let console_arg = console;  // void console;

  await poll_feeds(rconn, iconn, onclick_channel, console_arg, options);

  // Dispose of resources. Do not close page-lifetime channel, but do close the
  // function-call-lifetime channel as it should be released asap
  rconn.close();
  iconn.close();
  onclick_channel.close();

  refresh_in_progress = false;
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

// Fired when user submits file browser dialog. Uses a function-call lifetime
// channel and use it instead of the page-lifetime channel to avoid the
// no-loopback issue.
async function uploader_input_onchange(event) {
  console.log('%s: started', uploader_input_onchange.name);
  const op = {};
  [op.rconn, op.iconn] = await Promise.all([db_open(), favicon_create_conn()]);
  op.channel = new BroadcastChannel(config_channel_name);
  op.console = console;  // temporary
  op.fetch_timeout = 5 * 1000;
  op.import_opml = import_opml;
  await op.import_opml(event.target.files);
  op.rconn.close();
  op.iconn.close();
  op.channel.close();
  console.log('%s: completed', uploader_input_onchange.name);
}

function export_menu_option_handle_click(event) {
  const title = 'Subscriptions';
  const filename = 'subscriptions.xml';
  slideshow_export_opml(title, filename).catch(console.warn);
}

function error_message_container_onclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}

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
  col.textContent = list_peek(feed.urls);
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

  page_style.page_style_onchange();
}

function body_font_menu_onchange(event) {
  const font_name = event.target.value;
  if (font_name) {
    localStorage.BODY_FONT_FAMILY = font_name;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  page_style.page_style_onchange();
}

function header_font_menu_init() {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = localStorage.HEADER_FONT_FAMILY;
  const default_option = document.createElement('option');
  default_option.value = '';
  default_option.textContent = 'Header Font';
  menu.appendChild(default_option);
  for (const font_name of config_fonts) {
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
  for (const font_name of config_fonts) {
    const option = document.createElement('option');
    option.value = font_name;
    option.textContent = font_name;
    if (font_name === current_body_font) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

async function slideshow_page_init() {
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

  page_style.page_style_onload();

  const entry_cursor_offset = 0, entry_cursor_limit = 6;

  const conn = await db_open();
  const iterate_entries_promise = db_for_each_viewable_entry(
      conn, entry_cursor_offset, entry_cursor_limit, slide_append);
  const iterate_feeds_promise =
      db_for_each_active_feed(conn, feeds_container_append_feed);
  await Promise.all([iterate_entries_promise, iterate_feeds_promise]);
  conn.close();

  loading_info_hide();
}

slideshow_page_init().catch(console.error);
