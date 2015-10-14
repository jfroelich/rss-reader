// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.idle = {};

// TODO: inactivity interval should maybe be a parameter or some
// external setting

// Idle if greater than or equal to this many seconds
lucu.idle.INACTIVITY_INTERVAL = 60 * 5;

// Gets the idle state, which is undefined when lacking permission
// See chrome.idle.queryState for more info.
lucu.idle.queryState = function(callback) {
  'use strict';
  chrome.permissions.contains({permissions: ['idle']}, 
  	lucu.idle.onCheckPermission.bind(null, callback));
};

lucu.idle.onCheckPermission = function(callback, permitted) {
  'use strict';

  if(!permitted) {
  	callback();
  	return;
  }

  chrome.idle.queryState(lucu.idle.INACTIVITY_INTERVAL, callback);
};
