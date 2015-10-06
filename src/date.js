// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.date = {};

// Found this somewhere I think on stackoverflow
lucu.date.isValid = function(date) {
  'use strict';
  return date && date.toString() === '[object Date]' && isFinite(date);
};

lucu.date.format = function(date, sep) {
  'use strict';
 
  if(!date)
    return '';
  var parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(sep || '');
};
