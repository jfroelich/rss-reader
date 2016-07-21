// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: fully deprecate, i don't see much value in this function

// Returns whether string1 is equal to string2, case-insensitive
// Assumes both arguments have the toUpperCase method
function equalsIgnoreCase(string1, string2) {
  if(string1 && string2) {
    return string1.toUpperCase() === string2.toUpperCase();
  }

  // e.g. is '' === '', is null === undefined etc
  return string1 === string2;
}
