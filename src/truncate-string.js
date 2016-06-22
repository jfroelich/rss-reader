// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
// TODO: how does one simply truncate without appending? The test below
// returns false for empty string so i could not use that. maybe something like
// typeof extension === 'string'?
// TODO: i just realized the callers of truncateString may be passing
// in strings with html entities. Those callers should not be using this
// function, or should resolve entities before using this function.
function truncateString(string, position, extension) {
  const ELLIPSIS = '\u2026';
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
}
