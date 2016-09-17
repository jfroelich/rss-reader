// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};

// Returns a new string where certain non-printable characters have been
// removed.
// TODO: The regex is from somewhere on stackoverflow, note it
rdr.filterControlChars = function(inputString) {
  return inputString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
};
