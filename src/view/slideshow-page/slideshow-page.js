// TODO: if main menu and left panel are separate from slideshow-page, then
// it would be better to separately load them as modules in the html

import './main-menu.js';
import './left-panel.js';

import * as config_control from '/src/control/config-control.js';
import * as db from '/src/db/db.js';
import {append_slide} from './append-slide.js';
import * as channel from './channel.js';
import {feeds_container_append_feed} from './feeds-container.js';
import {show_no_articles_message} from './no-articles-message.js';
import {onkeydown} from './onkeydown.js';
import {hide_splash, show_splash} from './splash.js';

async function load_view() {
  show_splash();

  const session = await db.open();
  const get_entries_promise = db.get_entries(session, 'viewable', 0, 6);
  const get_feeds_promise = db.get_feeds(session, 'all', true);
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
