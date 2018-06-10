import {favicon_create_conn} from '/src/favicon.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import {open_db} from '/src/db.js';
import {options_menu_hide, options_menu_show} from '/src/slideshow-page/left-panel.js';

let refresh_in_progress = false;

async function refresh_button_onclick(event) {
  event.preventDefault();

  if (refresh_in_progress) {
    return;
  }

  refresh_in_progress = true;

  // Create a local channel object because apparently a channel cannot notify
  // itself (at least in Chrome 66) despite what spec states
  const onclick_channel = new BroadcastChannel(localStorage.channel_name);

  const rconn = await open_db();
  const iconn = await favicon_create_conn();

  const options = {};
  options.ignore_recency_check = true;
  await poll_feeds(rconn, iconn, onclick_channel, options);

  // Dispose of resources
  rconn.close();
  iconn.close();
  onclick_channel.close();

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

export function reader_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = false;

  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = true;

  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'block';

  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'none';
}

// TODO: clarify by renaming to something like view_feeds_button_onclick?
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

// Initialize things on module load. Note how modules become ready only after
// the dom is ready, so elements should be findable.

const toggle_left_panel_button = document.getElementById('main-menu-button');
toggle_left_panel_button.onclick = toggle_left_pannel_button_onclick;

const refresh_button = document.getElementById('refresh');
refresh_button.onclick = refresh_button_onclick;

const feeds_button = document.getElementById('feeds-button');
feeds_button.onclick = feeds_button_onclick;

const reader_button = document.getElementById('reader-button');
reader_button.onclick = reader_button_onclick;
