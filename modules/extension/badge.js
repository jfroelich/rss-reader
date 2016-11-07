// See license.md

'use strict';

async function badge_update_text(store, log = SilentConsole) {
  const count = await store.countUnreadEntries();
  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({'text': text});
}

async function badge_onclick(event) {
  const view_url = chrome.extension.getURL('slideshow.html');
  const newtab_url = 'chrome://newtab/';
  // If the extension is open in an existing tab then switch to that tab
  let tabs = await query_tabs_by_url(view_url);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
    return;
  }
  // If the extension is not open but the new tab tab is, replace the new
  // tab tab with the extension.
  tabs = await query_tabs_by_url(newtab_url);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': view_url});
    return;
  }

  // Otherwise, open the extension in a new tab
  chrome.tabs.create({'url': view_url});
}
