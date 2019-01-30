// TODO: append-slide should be relying on css-based truncation rather than
// calling truncate_html BUG: create_article_title_element is double encoding
// entities, so entities show up in the value. I partially fixed by not escaping
// ampersand but that's not the correct solution.
// TODO: the creation of a slide element, and the appending of a slide element,
// should be two separate tasks. This will increase flexibility and maybe
// clarity. append_slide should accept a slide element, not an entry. It is
// confusing that this function is named append_slide, but it accepts an entry,
// not a slide, which is just plain bad naming.
// TODO: the default duration should come from localStorage, and be stored
// in localStorage instead of maintained here in module scope, and should be
// accessed using config module io operations. Duration should be a configurable
// option customizable by the user, because slide animation speed can be a real
// tactile encumbrance

import {assert} from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as config_control from '/src/config-control.js';
import * as config from '/src/config.js';
import * as favicon from '/src/favicon.js';
import * as ops from '/src/ops.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import * as utils from '/src/utils.js';


const splash_element = document.getElementById('initial-loading-panel');
const feeds_container = document.getElementById('feeds-container');
if (feeds_container) {
  feeds_container.onclick = feeds_container_onclick;
} else {
  console.warn('could not find feeds-container');
}

let duration = 0.16;  // Slide animation speed (smaller is faster)
let channel;
let refresh_in_progress = false;
const no_articles_element = document.getElementById('no-entries-message');
let current_slide = null;
let active_transition_count = 0;



async function show_next_slide() {
  if (get_active_transition_count()) {
    return;
  }

  const current_slide = get_current_slide();
  if (!current_slide) {
    return;
  }

  const session = await cdb.open();
  await mark_slide_read_start(session, current_slide);

  const slide_unread_count = count_unread_slides();
  let entries = [];
  if (slide_unread_count < 3) {
    let limit = undefined;
    const config_limit = config.read_int('initial_entry_load_limit');
    if (!isNaN(config_limit)) {
      limit = config_limit;
    }

    const mode = 'viewable';
    entries = await cdb.get_entries(session, mode, slide_unread_count, limit);
  }
  session.close();

  for (const entry of entries) {
    if (!document.querySelector('slide[entry="' + entry.id + '"]')) {
      append_slide(entry);
    } else {
      console.debug('Entry already loaded', entry.id);
    }
  }

  const next_slide = current_slide.nextElementSibling;
  if (next_slide) {
    increment_active_transition_count();
    current_slide.style.left = '-100%';
    next_slide.style.left = '0';
    set_current_slide(next_slide);
  }

  if (entries.length) {
    compact_slides();
  }
}

function compact_slides() {
  const current_slide = get_current_slide();
  if (!current_slide) {
    return;
  }

  // The maximum number of slides loaded at any one time.
  // TODO: this should come from local storage
  const max_load_count = 6;
  const container = document.getElementById('slideshow-container');
  let first_slide = container.firstElementChild;
  while (container.childElementCount > max_load_count &&
         first_slide !== current_slide) {
    remove_slide(first_slide);
    first_slide = container.firstElementChild;
  }
}

function show_prev_slide() {
  if (get_active_transition_count()) {
    console.debug('Canceling previous navigation');
    return;
  }

  const current_slide = get_current_slide();
  if (!current_slide) {
    return;
  }

  const previous_slide = current_slide.previousElementSibling;
  if (!previous_slide) {
    return;
  }

  increment_active_transition_count();
  current_slide.style.left = '100%';
  previous_slide.style.left = '0';
  set_current_slide(previous_slide);
}


function get_current_slide() {
  return current_slide;
}

function set_current_slide(slide_element) {
  current_slide = slide_element;
}

function is_current_slide(slide_element) {
  return slide_element === current_slide;
}

function get_active_transition_count() {
  return active_transition_count;
}

function set_active_transition_count(count) {
  active_transition_count = count;
}

function increment_active_transition_count() {
  active_transition_count++;
}

// Do not allow transition to negative
function decrement_active_transition_count() {
  if (active_transition_count > 0) {
    active_transition_count--;
  }
}


async function slide_onclick(event) {
  // Only intercept left clicks
  const LEFT_MOUSE_BUTTON_CODE = 1;
  if (event.which !== LEFT_MOUSE_BUTTON_CODE) {
    return true;
  }

  // Only intercept clicks on or within an anchor element. Note that closest
  // checks not only ancestors but also the element itself.
  const anchor = event.target.closest('a');
  if (!anchor) {
    return true;
  }

  // Only intercept if the anchor has an href
  const url_string = anchor.getAttribute('href');
  if (!url_string) {
    return;
  }

  // Begin intercept. Cancel the normal click reaction
  event.preventDefault();

  // Open the link in a new tab via a technique that Chrome tolerates
  chrome.tabs.create({active: true, url: url_string});


  // Find the clicked slide. Start from parent because we know that the anchor
  // itself is not a slide. We know that a slide will always be found
  const slide = anchor.parentNode.closest('slide');

  // If the click was on the article title, mark as read always. If not then
  // it depends on whether url is similar.
  if (!anchor.matches('.entry-title')) {
    const entry_url = find_slide_url(slide);
    if (entry_url) {
      let clicked_url;
      try {
        clicked_url = new URL(url_string);
      } catch (error) {
        // if there is a problem with the url itself, no point in trying to
        // mark as read
        console.warn(error);
        return;
      }

      if (clicked_url) {
        // If the click was on a link that does not look like it points to the
        // article, then do not mark as read
        if (!are_similar_urls(entry_url, clicked_url)) {
          return;
        }
      }
    }
  }

  // Mark the clicked slide as read. While these conditions are redundant with
  // the checks within mark_slide_read_start, it avoids opening the connection.
  if (!slide.hasAttribute('stale') && !slide.hasAttribute('read') &&
      !slide.hasAttribute('read-pending')) {
    const session = await cdb.open();
    await mark_slide_read_start(session, slide);
    session.close();
  }
}

// Return whether both urls point to the same entry
// TODO: make this stricter. This should be checking path
function are_similar_urls(entry_url, clicked_url) {
  return entry_url.origin === clicked_url.origin;
}

// Find the entry url of the slide. This is a hackish solution to the problem
// that for each anchor clicked I need to be able to compare it to the url of
// the article containing the anchor, but the view doesn't provide this
// information upfront, so we have to go and find it again. Given that we are in
// a forked event handler, fortunately, performance is less concerning. In fact
// it is feels better to defer this cost until now, rather than some upfront
// cost like storing the href as a slide attribute or per anchor or calculating
// some upfront per-anchor attribute as an apriori signal.
function find_slide_url(slide) {
  const title_anchor = slide.querySelector('a.entry-title');
  // Should never happen. I suppose it might depend on how a slide without a
  // url is constructed in html. We cannot rely on those other implementations
  // here because we pretend not to know how those implementations work.
  if (!title_anchor) {
    return;
  }

  const entry_url = title_anchor.getAttribute('href');
  // Can happen, as the view makes no assumptions about whether articles have
  // urls (only the model imposes that constraint)
  if (!entry_url) {
    return;
  }

  let entry_url_object;
  try {
    entry_url_object = new URL(entry_url);
  } catch (error) {
    // If there is an entry title with an href value, it should pretty much
    // always be valid. But we are in a context where we cannot throw the error
    // or deal with it, so we just log as a non-fatal but significant error.
    console.warn(error);
  }

  return entry_url_object;
}

function show_no_articles_message() {
  no_articles_element.style.display = 'block';
}

function hide_no_articles_message() {
  no_articles_element.style.display = 'none';
}

// Starts transitioning a slide into the read state. Updates both the view and
// the database. This resolves before the view is fully updated. This only sets
// the slide's read-pending attribute, not its read attribute.
async function mark_slide_read_start(session, slide) {
  const entry_id_string = slide.getAttribute('entry');
  const entry_id = parseInt(entry_id_string, 10);

  // Exit if prior call still in flight. Callers may naively make concurrent
  // calls to mark_slide_read_start. This is routine, expected, and not an
  // error.
  if (slide.hasAttribute('read-pending')) {
    return;
  }

  // The slide was already read. Typically happens when navigating away from a
  // slide a second time. Not an error.
  if (slide.hasAttribute('read')) {
    return;
  }

  // A slide is stale for various reasons such as its corresponding entry being
  // deleted from the database. Callers are not expected to avoid calling this
  // on stale slides. Not an error.
  if (slide.hasAttribute('stale')) {
    return;
  }

  // Signal to future calls that this is now in progress
  slide.setAttribute('read-pending', '');

  await cdb.mark_entry_read(session, entry_id);
}

function remove_slide(slide) {
  slide.remove();
  slide.removeEventListener('click', slide_onclick);
}

// This should be called once the view acknowledges it has received the message
// sent to the channel by mark_slide_read_start to fully resolve the mark read
// operation.
function mark_slide_read_end(slide) {
  // Do not exit early if the slide is stale. Even though updating the state of
  // a stale slide seems meaningless, other algorithms such as counting unread
  // slides may be naive and only consider the read attribute
  slide.setAttribute('read', '');
  slide.removeAttribute('read-pending');
}

async function refresh_button_onclick(event) {
  event.preventDefault();

  if (refresh_in_progress) {
    return;
  }

  refresh_in_progress = true;

  const promises = [cdb.open(), favicon.open()];
  const [session, iconn] = await Promise.all(promises);
  await poll_feeds(session, iconn, {ignore_recency_check: true});
  session.close();
  iconn.close();

  refresh_in_progress = false;
}

function toggle_left_pannel_button_onclick(event) {
  const menu_options = document.getElementById('left-panel');
  if (menu_options.style.marginLeft === '0px') {
    options_menu_hide();
  } else if (menu_options.style.marginLeft === '') {
    options_menu_show();
  } else {
    options_menu_show();
  }
}

function view_articles_button_onclick(event) {
  // First toggle button states.

  // We are switching to the view-articles state. The view-feeds button may
  // have been disabled. Ensure it is enabled.
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = false;

  // We are switch to the view-articles state. Disable the view-articles button
  // in the new state.
  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = true;

  // Hide the view-feeds panel.
  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'none';

  // Show the view-articles panel.
  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'block';

  // The visibility of the no-articles-to-display message is independent of
  // the slideshow-container. It must be manually made visible again if there
  // are no articles.
  const num_slides = slideshow_container.childElementCount;
  if (!num_slides) {
    show_no_articles_message();
  }
}

// TODO: clarify by renaming to something like view_feeds_button_onclick?
function feeds_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = true;

  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = false;

  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'none';

  // The 'no articles to display' message is not contained within the slideshow
  // container, so it must be independently hidden
  hide_no_articles_message();

  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'block';
}

const toggle_left_panel_button = document.getElementById('main-menu-button');
toggle_left_panel_button.onclick = toggle_left_pannel_button_onclick;

const refresh_button = document.getElementById('refresh');
refresh_button.onclick = refresh_button_onclick;

const feeds_button = document.getElementById('feeds-button');
feeds_button.onclick = feeds_button_onclick;

const reader_button = document.getElementById('reader-button');
reader_button.onclick = view_articles_button_onclick;

function options_menu_show() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '0';
  menu_options.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

function options_menu_hide() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '-320px';

  // TODO: do I just delete the prop? How to set back to initial or whatever?
  // Is it by setting to 'none' or 'initial' or 'inherit' or something like
  // that?
  menu_options.style.boxShadow = '';
}

function import_opml_prompt() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'application/xml');
  input.onchange = async function(event) {
    // For unknown reason we must grab this before the await, otherwise error.
    // This behavior changed sometime around Chrome 72 without warning
    const files = event.target.files;
    const session = await cdb.open();
    console.debug('Connected, about to import %d files', files.length);
    await ops.opml_import(session, files);
    session.close();
  };
  input.click();
}

// TODO: handling all clicks and then forwarding them to click handler seems
// dumb. I should be ignoring clicks on such buttons. Let them continue
// progation. The buttons should instead have their own handlers.
async function options_menu_onclick(event) {
  const option = event.target;
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      alert('Not yet implemented, subscribe using options page');
      break;
    case 'menu-option-import':
      import_opml_prompt();
      break;
    case 'menu-option-export':
      const document_title = 'Subscriptions';
      const opml_document = await ops.export_opml(document_title);
      const file_name = 'subscriptions.xml';
      download_opml_document(opml_document, file_name);
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

// Given an opml document, converts it into a file and then triggers the
// download of that file in the browser.
function download_opml_document(opml_document, file_name = 'subs.xml') {
  // Generate a file. Files implement the Blob interface so we really just
  // generate a blob.
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  const blob = new Blob([xml_string], {type: 'application/xml'});

  // Download the blob file by simulating an anchor click
  // NOTE: this was broken in Chrome 65 and then fixed. For Chrome 65, using
  // the chrome.downloads technique worked as an alternative, but now that also
  // no longer works, and this anchor strategy works again
  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name);
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}

function header_font_menu_init(fonts) {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = config.read_string('header_font_family');
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

function body_font_menu_init(fonts) {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = body_font_menu_onchange;
  const current_body_font = config.read_string('body_font_family');
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

function header_font_menu_onchange(event) {
  const font_name = event.target.value;
  const old_value = config.read_string('header_font_family');
  if (font_name) {
    config.write_string('header_font_family', font_name);
  } else {
    config.remove('header_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config_control.storage_onchange({
    isTrusted: true,
    type: 'storage',
    key: 'header_font_family',
    newValue: font_name,
    oldValue: old_value
  });
}

function body_font_menu_onchange(event) {
  const font_name = event.target.value;
  const old_value = config.read_string('body_font_family');
  if (font_name) {
    config.write_string('body_font_family', font_name);
  } else {
    config.remove('body_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config_control.storage_onchange({
    isTrusted: true,
    type: 'storage',
    key: 'body_font_family',
    newValue: font_name,
    oldValue: old_value
  });
}

// Handle clicks outside of the left panel. The left panel should close by
// clicking anywhere else. So we listen for clicks anywhere, check if the click
// was outside of the left panel, and if so, then hide the left panel. Ignored
// clicks are left as is, and passed along untouched to any other listeners.
// Clicks on the main menu are ignored because that is considered a part of the
// menu structure. Clicks on the left panel are ignored because that should not
// cause the left panel to hide.
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

function leftpanel_init() {
  const menu_options = document.getElementById('left-panel');
  menu_options.onclick = options_menu_onclick;

  // Load fonts from configuration once for both init helpers
  const fonts = config.read_array('fonts');
  header_font_menu_init(fonts);
  body_font_menu_init(fonts);

  window.addEventListener('click', window_onclick);
}

// Initialize things on module load
leftpanel_init();

function channel_init() {
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
  const badge_types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (badge_types.includes(message.type)) {
    ops.badge_refresh();  // intentionally unawaited
  }

  // Type handlers are ordered by estimated frequency. Using if-blocks because I
  // found the switch syntax hard to read.
  const type = message.type;

  if (type === 'entry-read') {
    const slide = find_slide_by_entry_id(message.id);
    if (slide) {
      mark_slide_read_end(slide);
    }
    return;
  }

  // TODO: this double test against type is awkward, need to revisit, but
  // currently only focused on deprecating entry-write message type
  if (type === 'entry-created' || type === 'entry-updated') {
    // For now, we only care about newly added articles, because we do support
    // hot-swapping content
    if (type !== 'entry-created') {
      return;
    }

    // One of the objectives of synchronizing the view is to load additional
    // articles that have since become available after the time the view was
    // already loaded. To do this, the current criteria uses the number of
    // unread articles in the view as an indicator.
    // TODO: should this come from config?
    const max_unread_before_suppress_load = 3;
    const unread_count = count_unread_slides();

    // If there are already enough unread articles, do nothing.
    if (unread_count > max_unread_before_suppress_load) {
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

    let limit = undefined;
    const session = await cdb.open();
    const entries =
        await cdb.get_entries(session, 'viewable', unread_count, limit);
    session.close();

    for (const entry of entries) {
      append_slide(entry);
    }
    return;
  }

  if (type === 'entry-deleted' || type === 'entry-archived') {
    const slide = find_slide_by_entry_id(message.id);
    // The slide may not exist (this is routine and not an error)
    if (slide) {
      if (is_current_slide(slide)) {
        // TODO: set to empty string instead (or will using one param work?)
        slide.setAttribute('stale', 'true');
      } else {
        remove_slide(slide);
      }
    }
    return;
  }

  if (type === 'feed-deleted') {
    // TODO: implement
    return;
  }

  if (type === 'feed-activated') {
    // TODO: implement
    return;
  }

  if (type === 'feed-deactivated') {
    // TODO: implement
    return;
  }

  if (type === 'feed-created') {
    // TODO: implement
    return;
  }

  if (type === 'feed-updated') {
    // TODO: implement
    return;
  }

  // All types should be explicitly handled, even if they do nothing but exit.
  // This message appearing serves as a continual incentive.
  console.warn('Unhandled message', JSON.stringify(message));
}

function onmessageerror(event) {
  console.warn(event);
}

function find_slide_by_entry_id(entry_id) {
  return document.querySelector('slide[entry="' + entry_id + '"]');
}

function append_slide(entry) {
  // Now that we know there will be at least one visible article, ensure the
  // no articles message is hidden
  hide_no_articles_message();

  const slide = create_slide(entry);
  attach_slide(slide);
}

function create_slide(entry) {
  assert(cdb.is_entry(entry));
  assert(Array.isArray(entry.urls));
  assert(entry.urls.length > 0);

  const slide = document.createElement('slide');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');

  const slide_pad_wrap = document.createElement('div');
  slide_pad_wrap.className = 'slide-padding-wrapper';
  slide_pad_wrap.appendChild(create_article_title_element(entry));
  slide_pad_wrap.appendChild(create_article_content_element(entry));
  slide_pad_wrap.appendChild(create_feed_source_element(entry));
  slide.appendChild(slide_pad_wrap);
  return slide;
}


function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', entry.urls[entry.urls.length - 1]);
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    title = utils.escape_html(title);
    title_element.setAttribute('title', title);

    // filter_publisher requires title be a string. we know it is a string here
    // so no need for extra sanity checks
    title = utils.filter_publisher(title);

    const max_length = config.read_int('entry_title_max_length');
    if (!isNaN(max_length)) {
      title = utils.truncate_html(title, max_length);
    }

    // Use innerHTML to allow entities
    title_element.innerHTML = title;
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
    buffer.push(format_date(entry.datePublished));
  }
  details.textContent = buffer.join('');
  source_element.appendChild(details);
  return source_element;
}

// TODO: this helper should probably be inlined into append_slide once I work
// out the API better. One of the main things I want to do is resolve the
// mismatch between the function name, append-slide, and its main parameter,
// a database entry object. I think the solution is to separate entry-to-element
// and append-element. This module should ultimately focus only on appending,
// not creation and coercion.
function attach_slide(slide) {
  const container = document.getElementById('slideshow-container');

  // Defer binding event listener until appending here, not earlier when
  // creating the element. We are not sure a slide will be used until it is
  // appended, and want to avoid attaching listeners to unused detached
  // elements.
  slide.addEventListener('click', slide_onclick);

  // In order for scrolling to react to keyboard shortcuts such as pressing
  // the down arrow key, the element must be focused, and in order to focus an
  // element, it must have the tabindex attribute.
  slide.setAttribute('tabindex', '-1');

  // Slides are positioned absolutely. Setting left to 100% places the slide off
  // the right side of the view. Setting left to 0 places the slide in the view.
  // The initial value must be defined here and not via css, before adding the
  // slide to the page. Otherwise, changing the style for the first slide causes
  // an unwanted transition, and I have to change the style for the first slide
  // because it is not set in css.
  slide.style.left = container.childElementCount === 0 ? '0' : '100%';

  // TODO: review if prefix was dropped

  // In order for scrolling a slide element with keyboard keys to work, the
  // slide must be focused. But calling element.focus() while a transition is
  // active, such as what happens when a slide is moved, interrupts the
  // transition. Therefore, schedule focus for when the transition completes.
  slide.addEventListener('webkitTransitionEnd', transition_onend);

  // The value of the duration variable is defined external to this function,
  // because it is mutable by other functions.

  // Define the animation effect that will occur when moving the slide. Slides
  // are moved by changing a slide's css left property. This triggers a
  // transition. The transition property must be defined dynamically in order to
  // have the transition only apply to a slide when it is in a certain state. If
  // set via css then this causes an undesirable immediate transition on the
  // first slide.
  slide.style.transition = `left ${duration}s ease-in-out`;

  // Initialize the current slide if needed
  if (!get_current_slide()) {
    // TODO: is this right? I think it is because there is no transition for
    // first slide, so there is no focus call. But maybe not needed?
    slide.focus();
    set_current_slide(slide);
  }

  container.appendChild(slide);
}

function is_valid_transition_duration(duration) {
  return !isNaN(duration) && isFinite(duration) && duration >= 0;
}

function set_transition_duration(input_duration) {
  if (!is_valid_transition_duration(input_duration)) {
    throw new TypeError('Invalid duration parameter', input_duration);
  }

  duration = input_duration;
}

// Handle the end of a transaction. Should not be called directly.
function transition_onend(event) {
  // The slide that the transition occured upon (event.target) is not guaranteed
  // to be equal to the current slide. We want to affect the current slide.
  // We fire off two transitions per animation, one for the slide being moved
  // out of view, and one for the slide being moved into view. Both transitions
  // result in call to this listener, but we only want to call focus on one of
  // the two elements. We want to be in the state where after both transitions
  // complete, the new slide (which is the current slide at this point) is now
  // focused. Therefore we ignore event.target and directly affect the current
  // slide only.
  const slide = get_current_slide();
  slide.focus();

  // There may be more than one transition effect occurring at the moment.
  // Inform others via global slideshow state that this transition completed.
  decrement_active_transition_count();
}

// Return a date as a formatted string. This is an opinionated implementation
// that is intended to be very simple. This tries to recover from errors and
// not throw.
function format_date(date) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // When using native date parsing and encountering an error, rather than throw
  // that error, a date object is created with a NaN time property. Which would
  // be ok but the format call below then throws if the time property is NaN
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  // The try/catch is just paranoia for now. This previously threw when date
  // contained time NaN.
  const formatter = new Intl.DateTimeFormat();
  try {
    return formatter.format(date);
  } catch (error) {
    console.debug(error);
    return 'Invalid date';
  }
}

// Returns the number of unread slide elements present in the view
function count_unread_slides() {
  const selector = 'slide:not([read]):not([read-pending])';
  const slides = document.body.querySelectorAll(selector);
  return slides.length;
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
  col.textContent = feed.urls[feed.urls.length - 1];
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

function feeds_container_onclick(event) {
  if (event.target.localName === 'div' && event.target.id) {
    toggle_details(event.target);
  }
}

function toggle_details(feed_element) {
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

function unsubscribe_button_onclick(event) {
  console.warn('Unsubscribe (not yet implemented)', event.target);
}

function onkeydown(event) {
  // Ignore edit intent
  const target_name = event.target.localName;
  if (target_name === 'input' || target_name === 'textarea') {
    return;
  }

  const LEFT = 37, RIGHT = 39;
  const N = 78, P = 80;
  const SPACE = 32;
  const code = event.keyCode;

  if (code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    show_next_slide();
  } else if (code === LEFT || code === P) {
    event.preventDefault();
    show_prev_slide();
  }
}


function show_splash() {
  splash_element.style.display = 'block';
}

function hide_splash() {
  splash_element.style.display = 'none';
}

async function load_view() {
  show_splash();

  const session = await cdb.open();
  const get_entries_promise = cdb.get_entries(session, 'viewable', 0, 6);
  const get_feeds_promise = cdb.get_feeds(session, 'all', true);
  session.close();

  // Wait for entries to finish loading (without regard to feeds loading)
  const entries = await get_entries_promise;

  if (!entries.length) {
    show_no_articles_message();
  }

  for (const entry of entries) {
    append_slide(entry);
  }

  // Hide the splash before feeds may have loaded. We start in the entries
  // 'tab' so the fact that feeds are not yet loaded should not matter.
  // NOTE: technically user can switch to feeds view before this completes.
  hide_splash();

  const feeds = await get_feeds_promise;
  for (const feed of feeds) {
    feeds_container_append_feed(feed);
  }
}

channel_init();
addEventListener('storage', config_control.storage_onchange);
addEventListener('keydown', onkeydown);
document.addEventListener('DOMContentLoaded', config_control.dom_load_listener);

load_view().catch(console.error);
