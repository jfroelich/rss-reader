// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

chrome.runtime.onInstalled.addListener(function(event) {
  'use strict';
  
  openDatabaseConnection(function(error, connection) {
  });

  // maybe install should also set the badge text to '?'
  //updateBadge();
  // TODO: set localStorage defaults
});

chrome.browserAction.onClicked.addListener(onBadgeClick);
