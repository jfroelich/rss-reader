// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


// TODO: consistently use a prefix like remove, don't switch between remove
// and strip and filter and so forth
// TODO: if these functions are truly not related, I am not sure why I decided
// to group them together. Perhaps they should be split apart into separate
// files

const StringUtils = {};

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: research the proper pattern
// /[^\x20-\x7E]+/g;
const RE_CONTROL_CHARACTER = /[\t\r\n]/g;

// TODO: rename to removeControlCharacters
StringUtils.stripControlCharacters = function(string) {
  if(string) {
    return string.replace(RE_CONTROL_CHARACTER,'');
  }
};

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
