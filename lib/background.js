// Code here runs on every load/reload of the background page

var extension = extension || {};

/**
 * Message event listener for the background page (only). I prefer a
 * simple switch instead of separate listeners or redispatching or
 * polymorphic dispatch because not much happens here. This also
 * gets us a sort of 'do only once' effect to the messages because
 * we know there is only one instance of the background page.
 *
 * NOTE: it's a bit unclear but basically I want the
 * responsibility of updating the badge to belong only to the
 * the background page. However, any one of the earlier processes
 * that generated certain messages could just as easily have called
 * updateBadge. updateBadge is defined in extension.js which is
 * included in views so anything can call it... It is also kinda
 * easier to do the call in place (e.g. for marking entry read,
 * update badge immediatey, but why does entry read dispatch a read
 * message then? ). So this is undecided and kinda unorganized.
 * Fortunately, repeated calls to updateBadge only do a tiny bit of
 * work so a couple redundant calls is not the end of the world
 * (for now). At the same time it just feels like it runs counter
 * to the point of even getting the message here. It also is kinda
 * like, why even send a message at all. Just for the do once effect?
 * Hard to describe.
 *
 * NOTE: notifications for sub/unsub have to be per calling context,
 * because batch import wants to suppress. i dont want to pass
 * around a notify flag everywhere in a message. There are really only
 * 3 contexts only 2 of which notify so its barely a DRY violation.
 */
extension.onBackgroundMessage = function(message) {

  switch(message.type) {
    case 'subscribe':
      extension.updateBadge();
      break;
    case 'unsubscribe':
      extension.updateBadge();
      break;
    case 'pollCompleted':
      // TEMP: debugging poll alarms
      console.log('pollCompleted %s processed %s feeds',
        message.feedsProcessed, message.feedsAdded);

      if(message.entriesAdded) {
        extension.showNotification(message.entriesAdded + ' new articles added.');
      }
      break;
  }
};


/**
 * Called when the extension's icon button is clicked
 * in Chrome's toolbar. Browser action distinguishes it
 * from page action in case page action is eventually
 * added. This tries to not open the extension additional
 * times, but this is not fullproof because the user can
 * open a new tab and copy and paste the url (btw, no
 * defensive code exists for that distaster scenario).
 *
 * NOTE: this should only be called from the background page
 *
 * TODO: whether to reuse the newtab page should possibly
 * be a setting that is disabled by default, so this should
 * be checking if that setting is enabled before querying for
 * the new tab.
 *
 * NOTE: the calls to chrome.tabs here are limited in such a
 * way as to not require the tabs permission. it was
 * required at one point then removed. It is possibly still
 * required but im not seeing it since im in dev context. tabs
 * perm is not decl in manifest.
 */
extension.onBrowserActionClick = function() {
  var viewURL = chrome.extension.getURL('slides.html');

  chrome.tabs.query({'url': viewURL}, function(tabs) {
    if(tabs.length) {
      // Open in one or more tabs
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      // Not open in any tabs
      chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {
        if(tabs.length) {
          // Replace the first available new tab
          chrome.tabs.update(tabs[0].id, {active:true,url: viewURL});
        } else {
          // Create a new tab
          chrome.tabs.create({url: viewURL});
        }
      });
    }
  });
};


/**
 * Called when any of the extension's alarms wakeup. For the time being
 * this is only the poll alarm.
 *
 * TODO: polling is ambiguous, should use a more specific name
 * NOTE: this all might need to be revised if we end up using per-feed
 * polling, so there is no need to agonize over the details yet.
 */
extension.onAlarm = function(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, onIdlePermissionChecked);
  }

  function onIdlePermissionChecked(permitted) {

    // Five minutes ought to be enough for anybody.
    var INACTIVITY_INTERVAL = 60 * 5;

    if(permitted) {
      chrome.idle.queryState(INACTIVITY_INTERVAL, onIdleStateQueried);
    } else {
      startPolling();
    }
  }

  function onIdleStateQueried(newState) {
    if(newState == 'locked' || newState == 'idle') {
      startPolling();
    }
  }
};

/**
 * Apparently this is also called when the extension is enabled or disabled.
 * Binds stuff, maybe causes database install/upgrade.
 */
extension.onInstalled = function() {

  var manifest = chrome.runtime.getManifest();

  console.log('Installing %s', manifest.name);

  // The side effect of counting unread entries when the database
  // does not exist yet is that this triggers database creation
  extension.updateBadge();

  chrome.browserAction.onClicked.addListener(extension.onBrowserActionClick);
  chrome.runtime.onMessage.addListener(extension.onBackgroundMessage);
  chrome.alarms.onAlarm.addListener(extension.onAlarm);

  // NOTE: in the future, this may be customizable per feed and will
  // need to be refactored.
  chrome.alarms.create('poll', {periodInMinutes: 20});
};


// TODO: is there a way to avoid this being called every time
// the app is loaded?
chrome.runtime.onInstalled.addListener(onExtensionInstalled);




// This one sync call is the sole reason extension.js has to be defined
// and included before background.js in the scripts list in the manifest.
// at the moment chrome generates the background page when using
// the auto-generated-background-page approach (based on the scripts
// array in the manifest), and the scripts are not async flagged in the
// generated page, so loading order can be controlled.

// TODO: if all calls to update badge and show notifications happen
// only in the background, and the code in extension.js was moved here,
// then extension.js could be deprecated and this would remove the
// requirement. That, or this could be wrapped in DOMContentLoaded. Or
// we could have two versions of updatebadge and show notification, one
// for frontend views and one for the background page, but this is
// repetition.
extension.updateBadge();