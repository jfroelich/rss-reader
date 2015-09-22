// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};
lucu.install = {};

// Handle the install event
// TODO: does this actually receive an 'event' parameter? need to 
// review the API

lucu.install.onInstall = function(event) {
  
  var connection = lucu.db.connect();

  // maybe install should also set the badge text to '?'
  //lucu.badge.update();
};

// TODO: is there a way to avoid this being called every time
// the background page is loaded, reloaded, enabled, or disabled?
chrome.runtime.onInstalled.addListener(lucu.install.onInstall);
