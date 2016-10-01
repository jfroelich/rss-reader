// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: is there a way to not do this on every page load?
chrome.runtime.onInstalled.addListener(function(event) {
  console.log('Installing extension ...');

  // This is also the first database call, which triggers database setup
  const badgeService = new BadgeUpdateService();
  badgeService.start();
});
