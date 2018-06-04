import '/src/cli.js';
import '/src/slideshow-page/channel-onmessage.js';
import '/src/slideshow-page/onkeydown.js';
import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/options-menu.js';

import {db_for_each_active_feed} from '/src/db/db-for-each-active-feed.js';
import {db_get_entries} from '/src/db/db-get-entries.js';
import {db_open} from '/src/db/db-open.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {feeds_container_append_feed} from '/src/slideshow-page/feeds-container.js';
import {page_style_onload} from '/src/slideshow-page/page-style-onload.js';
import {hide_splash, show_splash} from '/src/slideshow-page/splash.js';

// Loads slideshow modules

// TODO: support back/forward browser buttons
// TODO: if loading initial feed list fails with an error, then show a friendly
// error message?

// TODO: this should come from localStorage or something
const entry_load_limit = 6;

async function load_data_into_view() {
  show_splash();
  page_style_onload();

  const conn = await db_open();

  // Start loading entries
  const load_entries_options = {};
  load_entries_options.limit = entry_load_limit;
  load_entries_options.offset = 0;
  load_entries_options.mode = 'viewable';
  const get_entries_promise = db_get_entries(conn, load_entries_options);

  // Start loading feeds
  // TODO: change db-get-feeds to accept a mode parameter, add a mode for
  // active-only, change this to use db-get-feeds in the active-only mode
  const get_feeds_promise =
      db_for_each_active_feed(conn, feeds_container_append_feed);

  // Wait for entries to finish loading (without regard to feeds loading)
  const entries = await get_entries_promise;
  for (const entry of entries) {
    append_slide(entry);
  }

  // Hide the splash before feeds may have loaded. We start in the entries
  // 'tab' so the fact that feeds are not yet loaded should not matter most of
  // the time. Technically user can switch to feeds view before this completes.
  hide_splash();

  // This does not need to be awaited in order to close the connection, but it
  // is awaited so that any exception is not swallowed.
  await get_feeds_promise;
  conn.close();
}

load_data_into_view().catch(console.error);
