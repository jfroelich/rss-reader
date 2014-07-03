
function onBackgroundMessage(message) {

  switch(message.type) {
    case 'entryRead':
      updateBadge();
      break;
    case 'importFeedsCompleted':

      var notification = (message.feedsAdded || 0) + ' of ';
      notification += (message.feedsProcessed || 0) + ' feeds imported with ';
      notification += message.exceptions ? message.exceptions.length : 0;
      notification += ' error(s).';
      showNotification(notification);

      break;
    case 'subscribe':
      updateBadge();

      if(message.feed) {
        var title = message.feed.title || message.feed.url;
        showNotification('Subscribed to ' + title);
      }

      break;
    case 'unsubscribe':
      updateBadge();
      break;
    case 'pollCompleted':

      updateBadge();

      if(message.entriesAdded) {
        showNotification(message.entriesAdded + ' new articles added.');
      }
      break;
    default:
      break;
  }
}


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
function onBrowserActionClick() {

  //console.log('Clicked extension button');

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
}


/**
 * Called when any of the extension's alarms wakeup. For the time being
 * this is only the poll alarm.
 *
 * TODO: polling is ambiguous, should use a more specific name
 * NOTE: this all might need to be revised if we end up using per-feed
 * polling, so there is no need to agonize over the details yet.
 */
function onBackgroundAlarm(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, onIdlePermissionChecked);
  }

  function onIdlePermissionChecked(permitted) {

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
}

/**
 * Binds stuff, maybe causes database install/upgrade.
 */
function onExtensionInstalled() {

  var manifest = chrome.runtime.getManifest();

  console.log('Installing %s', manifest.name);

  // This also triggers database creation
  updateBadge();

}

// TODO: is there a way to avoid this being called every time
// the background page is loaded or reloaded?
// This is also calling the function when the extension is
// enabled or disabled.
chrome.runtime.onInstalled.addListener(onExtensionInstalled);


chrome.runtime.onMessage.addListener(onBackgroundMessage);
chrome.alarms.onAlarm.addListener(onBackgroundAlarm);

chrome.browserAction.onClicked.addListener(onBrowserActionClick);


// Eventually this may be customizable per feed and will
// need to be refactored.
chrome.alarms.create('poll', {periodInMinutes: 20});