// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// A quick and dirty way to get a formatted date
function date_format(date, delimiter) {
  'use strict';

  if(!date) {
    return '';
  }

  const parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(delimiter || '');
}

// TODO: check whether there is a better way to do this in ES6
// TODO: compare to other lib implementations, e.g. how does underscore/lo-dash
// do it?
// See http://stackoverflow.com/questions/1353684
function date_is_valid(date) {
  'use strict';

  // TODO: use Object.prototype.toString.call instead of date.toString

  return date && date.toString() === '[object Date]' && isFinite(date);
}
