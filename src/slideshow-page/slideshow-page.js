import '/src/slideshow-page/main-menu.js';
import '/src/slideshow-page/left-panel.js';

import * as config_control from '/src/config.js';
import {openModelAccess} from '/src/model/model-access.js';
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

  const ma = await openModelAccess(/* channeled */ false);
  const get_entries_promise = ma.getEntries('viewable', 0, 6);
  const get_feeds_promise = ma.getFeeds('all', true);
  ma.close();

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
