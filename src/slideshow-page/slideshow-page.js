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
import {hide_splash, show_splash} from '/src/slideshow-page/splash.js';

// Loads slideshow modules

// TODO: support back/forward browser buttons
// TODO: if loading initial feed list fails with an error, then show a friendly
// error message?

const entry_load_limit = 6;

async function load_data_into_view() {
  show_splash();
  page_style_onload();

  const entry_load_offset = 0;
  const conn = await db_open();

  // Fire off both queries concurrently, without waiting for completion.
  const load_entries_promise = db_for_each_viewable_entry(
      conn, entry_load_offset, entry_load_limit, append_slide);
  const load_feeds_promise =
      db_for_each_active_feed(conn, feeds_container_append_feed);

  // Promise.all waiting for both is not ideal, because we want to show content
  // asap, so only wait for the first query to complete before hiding the splash
  // screen.
  await load_entries_promise;
  hide_splash();

  // This does not need to be awaited in order to close the connection, but it
  // is awaited so that any exception is not swallowed.
  await load_feeds_promise;
  conn.close();
}

load_data_into_view().catch(warn);
