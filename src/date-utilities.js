// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Very basic date handling functions
// TODO: eventually switch to moments.js and deprecate this

'use strict';

function formatDate(date, sep) {
  if(date) {
    return [date.getMonth() + 1, date.getDate(),date.getFullYear()].join(sep || '');
  }

  return '';
}

function parseDate(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  // Native date parsing does not always yield a valid date.
  // Try to avoid returning an invalid date

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
}
