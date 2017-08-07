// See license.md
'use strict';

async function ext_update_badge(verbose) {
  if(verbose)
    console.log('Updating badge text');
  let count = 0;
  let conn, db_name, db_version, conn_timeout_ms;
  try {
    conn = await reader_open_db(db_name, db_version, conn_timeout_ms, verbose);
    if(verbose)
      console.log('Counting unread entries in db', conn.name);
    count = await db_count_unread_entries(conn);
  } catch(error) {
    console.warn(error);
    return;
  } finally {
    if(conn)
      conn.close();
  }

  const text = count > 999 ? '1k+' : '' + count;
  if(verbose)
    console.log('Setting extension badge text to', text);
  chrome.browserAction.setBadgeText({'text': text});
}

function db_count_unread_entries(conn) {
  function executor(resolve, reject) {
    if(typeof ENTRY_STATE_UNREAD === 'undefined')
      throw new ReferenceError('ENTRY_STATE_UNREAD is undefined');
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(executor);
}

async function ext_show_slideshow_tab() {
  const slideshow_url_string = chrome.extension.getURL('slideshow.html');
  const newtab_url_string = 'chrome://newtab/';

  let tabs = await ext_find_tabs_by_url(slideshow_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
    return;
  }

  tabs = await ext_find_tabs_by_url(newtab_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id,
      {'active': true, 'url': slideshow_url_string});
    return;
  }

  chrome.tabs.create({'url': slideshow_url_string});
}

function ext_find_tabs_by_url(url_string) {
  function resolver(resolve, reject) {
    return chrome.tabs.query({'url': url_string}, resolve);
  }
  return new Promise(resolver);
}

function ext_show_notification(title, message, icon_url_string) {
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
  notification.addEventListener('click', ext_notification_on_click);
}

async function ext_notification_on_click(event) {
  try {
    // Ensure the browser is open to avoid mac chrome crash in 55
    // TODO: test if this behavior is still present in latest chrome and if
    // not then remove the window stuff.
    const window_handle = window.open();
    window_handle.close();
    await ext_show_slideshow_tab();
  } catch(error) {
    console.warn(error);
  }
}
