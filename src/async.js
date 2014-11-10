// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// An adapation of caolin's async.each
lucu.asyncForEach = function(arrayLike, step, callback) {
  'use strict';
  var forEach = Array.prototype.forEach;
  var counter = arrayLike.length;
  if(!counter) return callback();
  forEach.call(arrayLike, function(value) {
    step(value, function () {
      counter = counter - 1;
      if(!counter) callback();
    });
  });
};
