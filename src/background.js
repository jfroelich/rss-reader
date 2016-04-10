// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Background code, should only be included in the extension's background page
// Requires: /src/archive.js
// Requires: /src/db.js
// Requires: /src/poll.js

// TODO: this is getting called on every background page load. I would
// prefer it did not. Maybe it is because I am calling addListener every
// time and instead should only be calling it if a listener is not already
// present. So maybe I should search for the listener?
// TODO: are there any other settings I should be installing?
function background_on_installed(event) {
  'use strict';

  console.log('Installing...');

  // Trigger database upgrade by opening a connection
  // This also updates the unread count.
  // TODO: I would like to immediately close the connection.
  // TODO: I would like to log an error if a problem occurred, this could be
  // the first sign of an installation problem.
  db_open(function on_open_noop(event) {});
}

chrome.runtime.onInstalled.addListener(background_on_installed);

// Called by Chrome when an alarm wakes up
function background_on_alarm(alarm) {
  'use strict';

  const alarmName = alarm.name;
  if(alarmName === BACKGROUND_ARCHIVE_ALARM_NAME) {
    archive_entries();
  } else if(alarmName === BACKGROUND_POLL_ALARM_NAME) {
    poll_start();
  }
}

const BACKGROUND_ARCHIVE_ALARM_NAME = 'archive';
const BACKGROUND_ARCHIVE_ALARM_SETTINGS = {'periodInMinutes': 24 * 60};
const BACKGROUND_POLL_ALARM_NAME = 'poll';
const BACKGROUND_POLL_ALARM_SETTINGS = {'periodInMinutes': 20};

chrome.alarms.create(BACKGROUND_ARCHIVE_ALARM_NAME,
  BACKGROUND_ARCHIVE_ALARM_SETTINGS);
chrome.alarms.create(BACKGROUND_POLL_ALARM_NAME,
  BACKGROUND_POLL_ALARM_SETTINGS);
chrome.alarms.onAlarm.addListener(background_on_alarm);

const BACKGROUND_VIEW_URL = chrome.extension.getURL('slides.html');

function background_on_badge_click() {
  'use strict';

  // TODO: Something went wrong upgrading from chrome 48 to 49. The query finds
  // the existing tab and updates it, but it is never displayed. It finds it
  // even where there is no visible matching tab. Also, the first time I
  // clicked it, Chrome crashed. Looking at release notes for 50, I am seeing
  // that they are mucking with tab management. They definitely broke something
  // because this was working for over a year.
  // For now, I've disabled the ability to simply re-focus the existing tab and
  // I simply open a new tab each time.
  //chrome.tabs.query({'url': viewURL}, background_on_query_for_view_tab);

  const initialTabSettings = {'url': BACKGROUND_VIEW_URL};
  chrome.tabs.create(initialTabSettings);
}

function background_on_query_for_view_tab(tabsArray) {
  'use strict';

  const didFindOpenViewTab = !!tabsArray.length;

  if(didFindOpenViewTab) {
    const existingTab = tabsArray[0];
    const newSettingsForExistingTab = {'active': true};
    chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
  } else {
    // TODO: is the trailing slash necessary?
    const NEW_TAB_QUERY = {'url': 'chrome://newtab/'};
    chrome.tabs.query(NEW_TAB_QUERY, background_on_query_for_new_tab);
  }
}

function background_on_query_for_new_tab(tabsArray) {
  'use strict';

  const didFindNewTab = !!tabsArray.length;

  if(didFindNewTab) {
    const existingTab = tabsArray[0];
    const newSettingsForExistingTab = {
      'active': true,
      'url': BACKGROUND_VIEW_URL
    };
    chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
  } else {
    const newViewTabSettings = {'url': BACKGROUND_VIEW_URL};
    chrome.tabs.create(newViewTabSettings);
  }
}

chrome.browserAction.onClicked.addListener(background_on_badge_click);
