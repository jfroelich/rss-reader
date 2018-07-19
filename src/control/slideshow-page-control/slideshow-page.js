import '/src/control/slideshow-page-control/main-menu.js';
import '/src/control/slideshow-page-control/left-panel.js';

import * as config_control from '/src/control/config-control.js';
import {openModelAccess} from '/src/model/model-access.js';
import {append_slide} from '/src/control/slideshow-page-control/append-slide.js';
import * as channel from '/src/control/slideshow-page-control/channel.js';
import {feeds_container_append_feed} from '/src/control/slideshow-page-control/feeds-container.js';
import {show_no_articles_message} from '/src/control/slideshow-page-control/no-articles-message.js';
import {onkeydown} from '/src/control/slideshow-page-control/onkeydown.js';
import {hide_splash, show_splash} from '/src/control/slideshow-page-control/splash.js';

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
