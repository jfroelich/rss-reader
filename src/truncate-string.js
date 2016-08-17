// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string at the given position, and then appends the extension
// string.
// If the extension is null or undefined or not a string, then an ellipsis
// is appended. If empty, then nothing is appended. If non-empty, then the
// extension is appended.
function truncate_string(inputString, position, optionalExtension) {
  console.assert(inputString);
  console.assert(!isNaN(position), 'invalid position %s', position);

  const ELLIPSIS = '\u2026';

  if(inputString.length > position) {
    let extensionString = null;

    if(typeof optionalExtension === 'string') {
      extensionString = optionalExtension;
    } else {
      extensionString = ELLIPSIS;
    }

    if(extensionString) {
      return inputString.substr(0, position) + extensionString;
    } else {
      return inputString.substr(0, position);
    }
  }
  return inputString;
}
