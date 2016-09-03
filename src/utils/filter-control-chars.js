// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a new string where certain non-printable characters have been
// removed.
// TODO: The regex is from somewhere on stackoverflow, note it
function filter_control_chars(input_str) {
  console.assert(input_str);
  return input_str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}
