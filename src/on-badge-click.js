// See license.md

'use strict';

{

const view_url = chrome.extension.getURL('slideshow.html');
const newtab_url = 'chrome://newtab/';

// TODO: is there a way to not do this on every page load?
chrome.browserAction.onClicked.addListener(function(event) {
  // NOTE: query requires 'tabs' permission
  chrome.tabs.query({'url': view_url}, on_query_for_view_tab);
});

function on_query_for_view_tab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
  } else {
    chrome.tabs.query({'url': newtab_url}, on_query_for_new_tab);
  }
}

function on_query_for_new_tab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': view_url});
  } else {
    chrome.tabs.create({'url': view_url});
  }
}

}
