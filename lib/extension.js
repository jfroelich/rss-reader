/**
 * Extension-related functions that can be
 * called from either views or the background page.
 */
var extension = extension || {};

/**
 * Sets the badge text to a count of unread entries, which
 * may be the value of 0.
 *
 * For the moment this intentionally does not set an upper
 * bound, but it could do something like:
 * (if count > 999 then '999+' else count.tostring)
 */
extension.updateBadge = function() {
  openDB(function(db) {
    // The count of unread entries is simply the number of
    // entries present in the unread index. Once an entry is
    // read, the unread property is deleted, so the entry gets
    // dropped from the index.

    // indexedDB does not support booleans we so we are using the
    // number 1 here like a magical number to represent true.

    // TODO: it might be educational to research whether indexedDB
    // imlementations optimize this use case. Looking at how LISP-
    // like streams and lists do lazy evaluation of length, it
    // probably isn't. The perf gain at this scope is probably
    // extremely marginal and not even worth it.

    var entryStore = db.transaction('entry').objectStore('entry');
    var unreadIndex = entryStore.index('unread');
    unreadIndex.count(1).onsuccess = function() {
      var count = this.result || 0;
      chrome.browserAction.setBadgeText({text: count.toString()});
    };
  });
};

/**
 * Show a notification if permitted. Lazily checks permission
 * because it can be changed at any time. Provides some basic
 * settings for the notification so that only the message
 * is needed as a parameter.
 *
 * @param message {string} the message
 */
extension.showNotification = function(message) {

  var requiredPermissions = {permissions: ['notifications']};
  chrome.permissions.contains(requiredPermissions, onCheckedPermitted);

  function onCheckedPermitted(permitted) {

    var manifest = chrome.runtime.getManifest();
    var options = {
      type: 'basic',
      title: manifest.name || 'Untitled',
      iconUrl: '/media/rss_icon_trans.gif',
      message: message
    };

    if(permitted) {
      chrome.notifications.create('honeybadger', options, utils.noop);
    }
  }
};