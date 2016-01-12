// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes various binary characters from a string
// NOTE: this is currently an incredibly simplified implementation that is
// incomplete. Not all characters are considered or removed.
function filterControlCharacters(string) {

  'use strict';

  // TODO: research the proper pattern
  // /[^\x20-\x7E]+/g;
  const RE_CONTROL_CHARACTER = /[\t\r\n]/g;

  if(string) {
    return string.replace(RE_CONTROL_CHARACTER, '');
  }
}
