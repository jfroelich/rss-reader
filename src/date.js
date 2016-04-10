// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// A quick and dirty way to get a formatted date string
function date_format(date, optionalDelimiterString) {
  'use strict';

  // Almost no guarding is done. Just fail on the date.getMonth line.

  if(!date) {
    return '';
  }

  const datePartsArray = [];
  datePartsArray.push(date.getMonth() + 1);
  datePartsArray.push(date.getDate());
  datePartsArray.push(date.getFullYear());
  return datePartsArray.join(optionalDelimiterString || '');
}

// TODO: check whether there is a better way to do this in ES6
// TODO: compare to other lib implementations, e.g. how does underscore/lo-dash
// do it?
// See http://stackoverflow.com/questions/1353684
function date_is_valid(date) {
  'use strict';

  const OBJECT_TO_STRING = Object.prototype.toString;

  return date && OBJECT_TO_STRING.call(date) === '[object Date]' &&
    isFinite(date);
}
