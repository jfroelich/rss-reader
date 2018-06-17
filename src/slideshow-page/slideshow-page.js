import '/src/cli/cli.js';
import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/left-panel.js';

import * as db from '/src/db/db.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import * as channel from '/src/slideshow-page/channel.js';
import {feeds_container_append_feed} from '/src/slideshow-page/feeds-container.js';
import {show_no_articles_message} from '/src/slideshow-page/no-articles-message.js';
import {onkeydown} from '/src/slideshow-page/onkeydown.js';
import {page_style_onload} from '/src/slideshow-page/page-style-onload.js';
import {hide_splash, show_splash} from '/src/slideshow-page/splash.js';

async function load_view() {
  channel.init();

  window.addEventListener('keydown', onkeydown);

  show_splash();
  page_style_onload();

  const offset = 0, limit = 6;
  const conn = await db.open_db();
  const get_entries_promise = db.get_entries(conn, 'viewable', offset, limit);
  const get_feeds_promise = db.get_feeds(conn, 'all', true);
  conn.close();

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

load_view().catch(console.error);
