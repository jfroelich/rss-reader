// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// Very basic date handling functions
// TODO: eventually switch to moments.js and deprecate this
lucu.date = {};

// Simple date formatting
lucu.date.simpleFormat = function(date, sep) {
  if(!date)
    return '';

  var parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(sep || '');
};

// Simple date parsing
lucu.date.parse = function(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  // Native date parsing
  // Does not always yield a valid date.
  // Try to avoid returning an invalid date

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
};
