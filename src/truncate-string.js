// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string at the given position, and then appends the extension
// string.
// If the extension is null or undefined, then an ellipsis is appended.
// If the extension is an empty string, then nothing is appended.
// If the extension is a string, then the extension is appended.
// Position is not validated. Position should be a positive integer.
function truncateString(string, position, optionalExtension) {
  const ELLIPSIS_CHARACTER = '\u2026';
  if(string && string.length > position) {
    let extensionString = null;

    if(typeof optionalExtension === 'string') {
      extensionString = optionalExtension;
    } else {
      extensionString = ELLIPSIS_CHARACTER;
    }

    if(extensionString) {
      return string.substr(0, position) + extensionString;
    } else {
      return string.substr(0, position);
    }
  }
  return string;
}
