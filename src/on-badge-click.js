// See license.md

'use strict';

function query_tabs_by_url(url) {
  return new Promise(function(resolve, reject) {
    // NOTE: query requires 'tabs' permission
    chrome.tabs.query({'url': url}, resolve);
  });
}

// TODO: is there a way to not do this on every page load?
chrome.browserAction.onClicked.addListener(async function(event) {
  const view_url = chrome.extension.getURL('slideshow.html');
  const newtab_url = 'chrome://newtab/';
  let tabs = await query_tabs_by_url(view_url);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
    return;
  }
  tabs = await query_tabs_by_url(newtab_url);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': view_url});
  } else {
    chrome.tabs.create({'url': view_url});
  }
});
