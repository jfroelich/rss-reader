// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};
lucu.install = {};

// Handle the install event
// TODO: does this actually receive an 'event' parameter? need to 
// review the API

lucu.install.onInstall = function(event) {
  'use strict';
  
  database.connect(onConnect);

  function onConnect(error, connection) {
  	// NOOP
  }

  // maybe install should also set the badge text to '?'
  //lucu.browser.updateBadge();

  // TODO: set localStorage defaults
};

// TODO: is there a way to avoid this being called every time
// the background page is loaded, reloaded, enabled, or disabled?
chrome.runtime.onInstalled.addListener(lucu.install.onInstall);

// Include only in background. This also means that badge.js must be 
// included in manifest before? Which means js files must be loaded 
// in order?

// This cannot be located in badge.js because that file is included in
// multiple files, which results in multiple click handlers being
// registered

// Binds on background page load
chrome.browserAction.onClicked.addListener(lucu.browser.onBadgeClick);
