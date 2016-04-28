// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: i think it was a mistake to determine whether a notification
// should be shown based on whether the permission is available. The
// permission should be always, and this should instead be checking
// a local storage variable. I would also need to change how the option
// works in options.html/options.js, and I would need to make sure the
// notifications permission is present in manifest.json
// Once I do that, this no longer needs to do anything async-related and
// the code is greatly simplified.
// Side note: anything else I based on this (like the idle check in polling)
// should also be changed to use local storage.

function notification_show(messageString) {
  const permissionQuery = {permissions: ['notifications']};
  chrome.permissions.contains(permissionQuery, on_check_permitted);

  function on_check_permitted(permitted) {
    if(!permitted) {
      return;
    }

    const extensionName = 'lucubrate';

    const notification = {
      type: 'basic',
      title: chrome.runtime.getManifest().name,
      iconUrl: '/images/rss_icon_trans.gif',
      message: messageString
    };

    chrome.notifications.create(extensionName, notification, callback);
  }

  // TODO: I think this is the on_click handler? Name it something clearer
  function callback() {}
}
