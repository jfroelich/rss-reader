// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.date = {};

// Found this somewhere I think on stackoverflow
lucu.date.isValid = function(date) {
  return date && date.toString() === '[object Date]' && isFinite(date);
};
