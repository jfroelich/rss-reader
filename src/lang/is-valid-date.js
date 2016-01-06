// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: check whether there is a better way to do this in ES6
// TODO: compare to other lib implementations, e.g. how does underscore/lo-dash
// do it?

// Adapted from http://stackoverflow.com/questions/1353684
function isValidDate(date) {
  'use strict';
  return date && date.toString() === '[object Date]' && isFinite(date);
}
