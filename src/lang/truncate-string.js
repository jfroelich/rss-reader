// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
// TODO: how does one simply truncate without appending? The test below
// returns false for empty string so i could not use that. maybe something like
// typeof extension === 'string'?
function truncateString(string, position, extension) {
  'use strict';

  // NOTE: I assume this gets optimized as it is invariant. Nevertheless,
  // I like defining it within its limited scope, and I don't think the
  // performance impact is important.
  const ELLIPSIS = '\u2026';

  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
}
