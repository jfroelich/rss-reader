import '/src/cli.js';
import '/src/slideshow-page/channel-onmessage.js';
import '/src/slideshow-page/onkeydown.js';
import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/options-menu.js';

import {db_for_each_active_feed} from '/src/db/db-for-each-active-feed.js';
import {db_for_each_viewable_entry} from '/src/db/db-for-each-viewable-entry.js';
import {db_open} from '/src/db/db-open.js';
import {warn} from '/src/log.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {feeds_container_append_feed} from '/src/slideshow-page/feeds-container.js';
import {page_style_onload} from '/src/slideshow-page/page-style-onload.js';
import {loading_info_hide, loading_info_show} from '/src/slideshow-page/splash.js';

// Loads slideshow modules

// TODO: support back/forward browser buttons
// TODO: if loading initial feed list fails with an error, then show a friendly
// error message?
// TODO: if articles are displayed by default, I do not need to wait for feeds
// to load before hiding the loading info panel

const entry_load_limit = 6;

async function load_data_into_view() {
  loading_info_show();
  page_style_onload();

  const entry_load_offset = 0;
  const conn = await db_open();
  const p1 = db_for_each_viewable_entry(
      conn, entry_load_offset, entry_load_limit, append_slide);
  const p2 = db_for_each_active_feed(conn, feeds_container_append_feed);
  await Promise.all([p1, p2]);
  loading_info_hide();
  conn.close();
}

load_data_into_view().catch(warn);
