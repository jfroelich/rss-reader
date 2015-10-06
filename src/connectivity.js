// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: rename to net.js, use lucu.net ns

lucu.isOffline = function() {
  'use strict';

  //var nav = window && window.navigator;
  var nav = navigator;
  return nav && nav.hasOwnProperty('onLine') && !nav.onLine;
};
