import '/src/view/slideshow-page/main-menu.js';
import '/src/view/slideshow-page/left-panel.js';

import * as config_control from '/src/control/config-control.js';
import ModelAccess from '/src/model-access.js';
import {append_slide} from '/src/view/slideshow-page/append-slide.js';
import * as channel from '/src/view/slideshow-page/channel.js';
import {feeds_container_append_feed} from '/src/view/slideshow-page/feeds-container.js';
import {show_no_articles_message} from '/src/view/slideshow-page/no-articles-message.js';
import {onkeydown} from '/src/view/slideshow-page/onkeydown.js';
import {hide_splash, show_splash} from '/src/view/slideshow-page/splash.js';

// TODO: if main menu and left panel are separate from slideshow-page, then
// it would be better to separately load them as modules in the html

async function load_view() {
  show_splash();

  const dal = new ModelAccess();

  const offset = 0, limit = 6;
  const conn = await dal.connect();
  const get_entries_promise = dal.getEntries('viewable', offset, limit);
  const get_feeds_promise = dal.getFeeds('all', true);
  dal.close();

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
