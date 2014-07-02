/**
 * Sets the badge text to a count of unread entries, which
 * may be the value of 0.
 *
 * For the moment this intentionally does not set an upper
 * bound, but it could do something like:
 * (if count > 999 then '999+' else count.tostring)
 */
function updateBadge() {

  openIndexedDB(function(db) {
    var entryStore = db.transaction('entry').objectStore('entry');
    var unreadIndex = entryStore.index('unread');
    unreadIndex.count().onsuccess = function() {
      var count = this.result || 0;
      chrome.browserAction.setBadgeText({text: count.toString()});
    };
  });
}

function showNotification(message) {
  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    if(!permitted)
      return;

    chrome.notifications.create('honeybadger', {
      type: 'basic',
      title: chrome.runtime.getManifest().name || 'Untitled',
      iconUrl: '/media/rss_icon_trans.gif',
      message: message
    }, noop);
  });
}