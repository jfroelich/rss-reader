// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: this is getting called on every background page load. I would
// prefer it did not. Maybe it is because I am calling addListener every
// time?
// TODO: are there any other settings I should be installing?
function onInstalled(event) {
  console.log('Installing extension ...');
  updateBadgeUnreadCount();
}

chrome.runtime.onInstalled.addListener(onInstalled);
