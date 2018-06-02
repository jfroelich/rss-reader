import {db_for_each_active_feed} from '/src/db/db-for-each-active-feed.js';
import {db_for_each_viewable_entry} from '/src/db/db-for-each-viewable-entry.js';
import {db_open} from '/src/db/db-open.js';
import {warn} from '/src/log.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {error_message_container_onclick} from '/src/slideshow-page/error-message.js';
import {feeds_button_onclick} from '/src/slideshow-page/feeds-button.js';
import {feeds_container_append_feed, feeds_container_onclick} from '/src/slideshow-page/feeds-container.js';
import {loading_info_hide, loading_info_show} from '/src/slideshow-page/loading-info.js';
import {body_font_menu_init, body_font_menu_onchange, header_font_menu_init, header_font_menu_onchange, main_menu_button_onclick} from '/src/slideshow-page/main-menu.js';
import {options_menu_onclick, options_menu_show} from '/src/slideshow-page/options-menu.js';
import {page_style_onload} from '/src/slideshow-page/page-style-onload.js';
import {refresh_anchor_onclick} from '/src/slideshow-page/refresh-anchor-onclick.js';
import {reader_button_onclick} from '/src/slideshow-page/view-reader-button.js';

// TODO: once this settles a bit, probably should merge into slideshow-page.js
// and consider slideshow-page.js as the loader module

// TODO: fix imports

// TODO: if loading initial feed list fails with an error, then show a friendly
// error message?
// TODO: because the loading function itself is called non-awaited, and because
// the slow part occurs at the very end, this function could be async and use
// await syntax rather than promise, which I prefer because the promise syntax
// is ugly.
async function slideshow_page_init() {
  loading_info_show();

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

  page_style_onload();

  const entry_cursor_offset = 0, entry_cursor_limit = 6;

  const conn = await db_open();
  const iterate_entries_promise = db_for_each_viewable_entry(
      conn, entry_cursor_offset, entry_cursor_limit, append_slide);
  const iterate_feeds_promise =
      db_for_each_active_feed(conn, feeds_container_append_feed);
  await Promise.all([iterate_entries_promise, iterate_feeds_promise]);
  conn.close();

  loading_info_hide();
}

slideshow_page_init().catch(warn);
