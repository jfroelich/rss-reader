// See license.md

'use strict';

// Resolves with an array of tabs. chrome.tabs.query requires 'tabs' permission
// in manifest or this may cause Chrome to crash or silently fail or not find
// any tabs. In older versions of Chrome, I think somewhere around before 33,
// this permission was not required. The docs last I checked have not made any
// mention of the API change.
// @param url {String} the url of the tab searched for
function query_tabs_by_url(url) {
  return new Promise(function query_tabs_impl(resolve) {
    chrome.tabs.query({'url': url}, (tabs) => {
      // Guarantee that tabs is defined. I have witnessed undefined.
      if(!tabs) {
        console.warn('chrome.tabs.query yielded invalid tabs value');

        tabs = [];
      }

      resolve(tabs);
    });
  });
}
