// See license.md

'use strict';

class Badge {

  // TODO: the parameter to this should be an entry store, not the conn
  // Or this should be non-static
  static async updateUnreadCount(conn) {
    const entryStore = new EntryStore(conn);
    const count = await entryStore.countUnread();
    const text = count > 999 ? '1k+' : '' + count;
    chrome.browserAction.setBadgeText({'text': text});
  }

  static onClick(event) {
    Badge.showExtension().catch(console.warn);
  }

  // If the extension is open in an existing tab then switch to that tab
  // If the extension is not open but the new tab tab is, replace the new
  // tab tab with the extension.
  // Otherwise, open the extension in a new tab and switch to it.
  // This fails if the window is closed
  static async showExtension() {
    const viewURL = chrome.extension.getURL('slideshow.html');
    const newtabURL = 'chrome://newtab/';
    let tabs = await Badge.queryTabs(viewURL);
    if(tabs && tabs.length)
      return chrome.tabs.update(tabs[0].id, {'active': true});
    tabs = await Badge.queryTabs(newtabURL);
    if(tabs && tabs.length)
      return chrome.tabs.update(tabs[0].id, {'active': true, 'url': viewURL});
    chrome.tabs.create({'url': viewURL});
  }

  // Resolves with an array of tabs. Requires 'tabs' permission
  // @param url {String} the url of the tab searched for
  static queryTabs(url) {
    return new Promise((resolve) => chrome.tabs.query({'url': url}, resolve));
  }
}
