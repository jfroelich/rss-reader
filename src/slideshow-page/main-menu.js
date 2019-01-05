import * as favicon from '/src/favicon/favicon-control.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';
import * as db from '/src/db/db.js';

import {options_menu_hide, options_menu_show} from './left-panel.js';
import {hide_no_articles_message, show_no_articles_message} from './no-articles-message.js';

let refresh_in_progress = false;

async function refresh_button_onclick(event) {
  event.preventDefault();

  if (refresh_in_progress) {
    return;
  }

  refresh_in_progress = true;

  const promises = [db.open_with_channel(), favicon.open()];
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
