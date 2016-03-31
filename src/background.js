// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Background code, should only be included in the extension's background page
// Requires: /src/db.js
// Requires: /src/poll-feeds.js
// Requires: /src/archive-entries.js

function background_on_installed(event) {
  'use strict';

  // NOTE: this is getting called on every background page load

  console.log('Installing...');
  // Trigger database upgrade by opening a connection
  db.open(function(event) {});
}

chrome.runtime.onInstalled.addListener(background_on_installed);

function background_on_alarm(alarm) {
  'use strict';

  const name = alarm.name;
  if(name === 'archive') {
    archive_entries();
  } else if(name === 'poll') {
    pollFeeds();
  }
}

chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
chrome.alarms.create('poll', {periodInMinutes: 20});
chrome.alarms.onAlarm.addListener(background_on_alarm);

var BACKGROUND_VIEW_URL = chrome.extension.getURL('slides.html');
// TODO: is the trailing slash necessary?
var BACKGROUND_NEWTAB_URL = 'chrome://newtab/';

function background_on_click() {
  'use strict';

  chrome.tabs.create({url: BACKGROUND_VIEW_URL});

  // TODO: the above works. Something went wrong upgrading from chrome 48...
  // to 49.... The query finds the existing tab and updates it, but it is
  // never displayed. It finds it even where there is no visible matching
  // tab. Also, the first time I clicked it, Chrome crashed. Review the
  // chrome tabs API.
  // TODO: looking at release notes for 50, I am seeing that they are
  // mucking with tab management
  //chrome.tabs.query({'url': viewURL}, background_on_query_view);
}

function background_on_query_view(tabs) {
  'use strict';
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true});
  } else {
    chrome.tabs.query({url: BACKGROUND_NEWTAB_URL},
      background_on_query_new_tab);
  }
}

function background_on_query_new_tab(tabs) {
  'use strict';

  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true, url: BACKGROUND_VIEW_URL});
  } else {
    chrome.tabs.create({url: BACKGROUND_VIEW_URL});
  }
}

chrome.browserAction.onClicked.addListener(background_on_click);
