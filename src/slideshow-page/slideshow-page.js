import '/src/cli.js';
import '/src/slideshow-page/channel-onmessage.js';
import '/src/slideshow-page/onkeydown.js';
import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/left-panel.js';
import {db_get_entries} from '/src/db/db-get-entries.js';
import {db_get_feeds} from '/src/db/db-get-feeds.js';
import {db_open} from '/src/db/db-open.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {feeds_container_append_feed} from '/src/slideshow-page/feeds-container.js';
import {show_no_articles_message} from '/src/slideshow-page/no-articles-message.js';
import {page_style_onload} from '/src/slideshow-page/page-style-onload.js';
import {hide_splash, show_splash} from '/src/slideshow-page/splash.js';

// Loads slideshow modules

// TODO: support back/forward browser buttons
// TODO: if loading initial feed list fails with an error, then show a friendly
// error message?

// NOTE: the logging is temp, looking at jank. At the moment the logging is
// demonstrating that everything completes rather quickly, but somehow the
// view does something funky regarding font loading and compositor refresh,
// like the append and render is somehow delayed, as if append_slide isn't
// sync or is somehow returning earlier than its side effects completed.

// TODO: this should come from localStorage or something
const entry_load_limit = 6;

async function load_data_into_view() {
  show_splash();
  console.debug('splash displayed');
  page_style_onload();
  console.debug('css loaded');

  const conn = await db_open();
  console.debug('conn open');
  const get_entries_promise = db_get_entries(
      conn, {limit: entry_load_limit, offset: 0, mode: 'viewable'});
  const get_feeds_promise = db_get_feeds(conn, {mode: 'all', sort: true});
  console.debug('queries in flight');
  conn.close();

  // Wait for entries to finish loading (without regard to feeds loading)
  const entries = await get_entries_promise;

  if (!entries.length) {
    show_no_articles_message();
  }

  for (const entry of entries) {
    append_slide(entry);
  }

  console.debug('queries appended');

  // Hide the splash before feeds may have loaded. We start in the entries
  // 'tab' so the fact that feeds are not yet loaded should not matter most of
  // the time. Technically user can switch to feeds view before this completes.
  hide_splash();
  console.debug('splash hidden');

  const feeds = await get_feeds_promise;
  for (const feed of feeds) {
    feeds_container_append_feed(feed);
  }

  console.debug('feeds appended, load complete');
}

load_data_into_view().catch(console.error);
