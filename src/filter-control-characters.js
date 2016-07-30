// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes non-printable characters from a string
// NOTE: I have only run a few tests
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function StringUtils.filterControlCharacters(string) {
  if(string) {
    return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }
}
