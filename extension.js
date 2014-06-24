/**
 * Extension functions
 */



/**
 * Message event listener for the background page
 *
 * NOTE: it's a bit unclear but basically I want the
 * responsibility of updating the badge to belong only to the
 * the background page. However, any one of the earlier processes
 * that generated the message could just as easily have called
 * updateBadge or showNotification.
 *
 * TODO: show notifications for subscribe/unsubscribe?
 */
function onBackgroundMessage(message) {

  switch(message.type) {
    case 'subscribe':
      updateBadge();
      break;
    case 'unsubscribe':
      updateBadge();
      break;
    case 'pollCompleted':
      console.log('Message: %s processed %s feeds',
        message.type, message.feedsProcessed);

      if(message.entriesAdded) {
        showNotification(message.entriesAdded + ' new articles added.');
      }
      break;
  }
}

/**
 * Called when the extension's icon is clicked
 *
 * TODO: whether to reuse the newtab page should possibly
 * be a setting that is disabled by default, so this should
 * be checking if that setting is enabled before querying for
 * the new tab.
 *
 * NOTE: the calls to chrome.tabs here are limited in such a
 * way as to not require the tabs permission.
 * NOTE: tries to not open the extension additional times, but
 * this is not fullproof because the user can open a new tab
 * and copy and paste the url. This is not a reliable singleton
 * guarantee.
 */
function onBrowserActionClick() {
  var viewURL = chrome.extension.getURL('slides.html');

  chrome.tabs.query({'url': viewURL}, function(tabs) {
    if(tabs.length) {
      // The extension is already open in a tab, just select it
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      // The extension is not open
      chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {

        if(tabs.length) {
          // Reuse the first available new tab by changing its
          // location and then selecting it.
          chrome.tabs.update(tabs[0].id, {active:true,url: viewURL});
        } else {
          // Create a new tab and select it.
          chrome.tabs.create({url: viewURL});
        }
      });
    }
  });
}

/**
 * Called when the extension is installed. Also called when the extension
 * is enabled or disabled in the Extensions page. Initializes various
 * other bindings.
 *
 * NOTE: this is only bound in background.js which is only loaded with the
 * non-persistent background scripts in the backgroundd page. Therefore
 * the binding calls in this function only affect the background page.
 */
function onExtensionInstalled() {

  var manifest = chrome.runtime.getManifest();

  console.log('Installing %s', manifest.name);

  // Initializes the badge text by opening a connection to
  // indexedDB and counting entries. The side effect of this on
  // first install is that it triggers an upgradeNeeded event,
  // which creates the object stores.
  updateBadge();

  // These bindings only need to happen once, at install time.

  // Binds an event listener for clicking on the extension's button
  chrome.browserAction.onClicked.addListener(onBrowserActionClick);

  // Binds a message event listener in the background page
  chrome.runtime.onMessage.addListener(onBackgroundMessage);

  // Binds an alarm listener
  chrome.alarms.onAlarm.addListener(onExtensionAlarm);

  // Creates a new alarm for periodically checking for updated content
  // NOTE: in the future, this may be customizable per feed and will
  // need to be refactored.
  chrome.alarms.create('poll', {periodInMinutes: 20});
}

/**
 * Called when any of the extension's alarms wakeup. For the time being
 * this is only the poll alarm.
 *
 * TODO: polling is ambiguous, should use a more specific name
 */
function onExtensionAlarm(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, onIdlePermissionChecked);
  }

  function onIdlePermissionChecked(permitted) {
    // Number of ms before considered idle
    var INACTIVITY_INTERVAL = 60 * 5;

    if(permitted) {
      chrome.idle.queryState(INACTIVITY_INTERVAL, onIdleStateQueried);
    } else {
      // Cannot determine idleness, so just start polling
      startPolling();
    }
  }

  function onIdleStateQueried(newState) {
    // There are three states. Only poll in event of two target states.
    if(newState == 'locked' || newState == 'idle') {
      startPolling();
    }
  }
}

function updateBadge() {
  openDB(function(db) {
    db.transaction('entry').objectStore('entry').index('unread').count(
      IDBKeyRange.only(1)).onsuccess = function(event) {
      var count = event.target.result || 0;
      chrome.browserAction.setBadgeText({text: count.toString()});
    };
  });
}


function showNotification(message) {
  var manifest = chrome.runtime.getManifest();
  var options = {
    type:'basic',
    title: manifest.name || 'Untitled',
    iconUrl:'rss_icon_trans.gif',
    message:message
  };

  chrome.permissions.contains({permissions: ['notifications']}, function(permitted) {
    if(permitted) {
      chrome.notifications.create('honeybadger', options, function() {});
    }
  });
}



