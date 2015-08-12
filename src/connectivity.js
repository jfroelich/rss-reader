// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.isOffline = function() {
  var nav = window && window.navigator;
  return nav && nav.hasOwnProperty('onLine') && !nav.onLine;
};
