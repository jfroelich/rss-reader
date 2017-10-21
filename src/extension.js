'use strict';

// import base/assert.js
// import base/debug.js

const EXTENSION_DEBUG = false;

function extension_idle_query(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

// TODO: create badge.js, wrapper function that just passes number to this
// function
// TODO: reintroduce conn param, do not connect locally
async function extension_update_badge_text() {
  if(EXTENSION_DEBUG) {
    DEBUG('updating badge text');
  }

  let count = 0, conn;

  try {
    conn = await reader_db_open();
    count = await reader_db_count_unread_entries(conn);
  } catch(error) {
    DEBUG(error);
    return ERR_DB_OP;
  } finally {
    if(conn)
      conn.close();
  }

  const text = count > 999 ? '1k+' : '' + count;
  if(EXTENSION_DEBUG)
    DEBUG('setting badge text to', text);
  chrome.browserAction.setBadgeText({'text': text});
  return STATUS_OK;
}

async function extension_show_slideshow_tab() {
  const slideshow_url_string = chrome.extension.getURL('slideshow.html');
  const newtab_url_string = 'chrome://newtab/';

  let tabs = await extension_find_tabs_by_url(slideshow_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
    return;
  }

  tabs = await extension_find_tabs_by_url(newtab_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id,
      {'active': true, 'url': slideshow_url_string});
    return;
  }

  chrome.tabs.create({'url': slideshow_url_string});
}

function extension_find_tabs_by_url(url_string) {
  function resolver(resolve, reject) {
    return chrome.tabs.query({'url': url_string}, resolve);
  }
  return new Promise(resolver);
}

function extension_notify(title, message, icon_url_string) {
  if(typeof Notification === 'undefined')
    return;

  if(!('SHOW_NOTIFICATIONS' in localStorage))
    return;

  if(Notification.permission !== 'granted')
    return;

  const default_icon_url_string =
    chrome.extension.getURL('/images/rss_icon_trans.gif');

  const details = {};
  details.body = message || '';
  details.icon = icon_url_string || default_icon_url_string;

  // Instantiation also shows
  const notification = new Notification(title, details);
  notification.addEventListener('click', extension_notification_on_click);
}

async function extension_notification_on_click(event) {
  try {
    // Ensure the browser is open to avoid mac chrome crash in 55
    // TODO: test if this behavior is still present in latest chrome and if
    // not then remove
    const window_handle = window.open();
    window_handle.close();
    await extension_show_slideshow_tab();
  } catch(error) {
    DEBUG(error);
  }
}
