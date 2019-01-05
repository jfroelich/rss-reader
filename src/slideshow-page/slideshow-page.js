import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/left-panel.js';
import * as config_control from '/src/config-control.js';
import * as db from '/src/db/db.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import * as channel from '/src/slideshow-page/channel.js';
import {show_no_articles_message} from '/src/slideshow-page/no-articles-message.js';
import {show_next_slide, show_prev_slide} from '/src/slideshow-page/slide-nav.js';

const feeds_container = document.getElementById('feeds-container');
feeds_container.onclick = feeds_container_onclick;

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

const splash_element = document.getElementById('initial-loading-panel');

function show_splash() {
  splash_element.style.display = 'block';
}

function hide_splash() {
  splash_element.style.display = 'none';
}

async function load_view() {
  show_splash();

  const session = await db.open();
  const get_entries_promise = db.get_entries(session, 'viewable', 0, 6);
  const get_feeds_promise = db.get_feeds(session, 'all', true);
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

channel.init();
addEventListener('storage', config_control.storage_onchange);
addEventListener('keydown', onkeydown);
document.addEventListener('DOMContentLoaded', config_control.dom_load_listener);

load_view().catch(console.error);
