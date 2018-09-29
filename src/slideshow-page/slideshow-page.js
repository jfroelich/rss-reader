import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/left-panel.js';

import * as config_control from '/src/config/config.js';
import * as db from '/src/db/db.js';
import {get_entries} from '/src/db/op/get-entries.js';
import {get_feeds} from '/src/db/op/get-feeds.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import * as channel from '/src/slideshow-page/channel.js';
import {feeds_container_append_feed} from '/src/slideshow-page/feeds-container.js';
import {show_no_articles_message} from '/src/slideshow-page/no-articles-message.js';
import {onkeydown} from '/src/slideshow-page/onkeydown.js';
import {hide_splash, show_splash} from '/src/slideshow-page/splash.js';

// TODO: if main menu and left panel are separate from slideshow-page, then
// it would be better to separately load them as modules in the html

async function load_view() {
  show_splash();

  const session = await db.open();
  const get_entries_promise = get_entries(session.conn, 'viewable', 0, 6);
  const get_feeds_promise = get_feeds(session.conn, 'all', true);
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
