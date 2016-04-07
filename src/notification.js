// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function notification_show(message) {
  'use strict';

  const notification = {
    type: 'basic',
    title: chrome.runtime.getManifest().name,
    iconUrl: '/images/rss_icon_trans.gif',
    message: message
  };

  // TODO: I think this is the on_click handler? Name it something clearer
  function callback() {}

  function show_if_permitted(permitted) {
    if(!permitted)
      return;
    chrome.notifications.create('lucubrate', notification, callback);
  }

  chrome.permissions.contains({permissions: ['notifications']},
    show_if_permitted);
}
