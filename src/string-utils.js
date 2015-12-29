// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const StringUtils = {};

{ // BEGIN ANONYMOUS NAMESPACE

const ELLIPSIS = '\u2026';

// Truncates a string at the given position, and then appends
// the extension string. An ellipsis is appended if an
// extension was not specified.
StringUtils.truncate = function(string, position, extension) {
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
};

} // END ANONYMOUS NAMESPACE
