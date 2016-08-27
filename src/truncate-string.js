// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string at the given position, and then appends the extension
// string. If the extension is null or undefined or not a string, then an
// ellipsis is appended. If the extension is an empty string, then nothing is
// appended. If the extension is a non-empty string , then the extension is
// appended.
function truncate_string(input_str, position, extension) {
  console.assert(input_str);
  console.assert(!isNaN(position));
  if(input_str.length > position) {
    const ELLIPSIS = '\u2026';
    let ext = (typeof extension === 'string') ? extension : ELLIPSIS;
    if(ext) {
      return input_str.substr(0, position) + ext;
    } else {
      return input_str.substr(0, position);
    }
  }
  return input_str;
}
