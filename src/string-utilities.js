// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Returns a string without control-like characters
 *
 * TODO: this needs a better name
 * TODO: this doesn't actually strip all binaries
 * TODO: \t\r\n is approximately \s, and could just be \s ?
 * TODO: what's the diff between \s/g and \s+/g  ?
 */
function stripControls(string) {
  return string && string.replace(/[\t\r\n]/g,'');
}

/**
 * Returns a string that has been shortened
 * NOTE: rename to elide?
 * NOTE: Array.prototype.slice ?
 */
function truncate(str, position, extension) {
  return str && (str.length > position) ?
    str.substr(0,position) + (extension || '...') :
    str;
}

/**
 * Returns the frequency of ch in str.
 *
 * See http://jsperf.com/count-the-number-of-characters-in-a-string
 * I assume this is a hot spot so not using reduce or the
 * split.length-1 approach.
 */
function countChar(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }
  return count;
}