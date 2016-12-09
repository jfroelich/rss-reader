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
    console.log('Clicked extension badge');
    ExtensionUtils.show().catch(console.warn);
  }
}
