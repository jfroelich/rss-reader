// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns whether string1 is equal to string2, case-insensitive
// Assumes both arguments have the toUpperCase method
function string_equals_ignore_case(string1, string2) {
  'use strict';

  if(string1 && string2) {
    return string1.toUpperCase() === string2.toUpperCase();
  }

  // e.g. is '' === '' or is null === undefined etc
  return string1 === string2;
}

// Removes non-printable characters from a string
// NOTE: untested
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function string_filter_controls(string) {
  'use strict';

  if(string) {
    return string.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }
}

// Truncates a string at the given position, and then appends the extension
// string. An ellipsis is appended if an extension was not specified.
// TODO: how does one simply truncate without appending? The test below
// returns false for empty string so i could not use that. maybe something like
// typeof extension === 'string'?
function string_truncate(string, position, extension) {
  'use strict';

  const ELLIPSIS = '\u2026';
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
}

// Split the string into an array of word-like token strings. This is very
// rudimentary.
function string_tokenize(string) {
  'use strict';

  if(!string) {
    return [];
  }

  const tokens = string.split(/s+/);

  // Filter zero-length strings
  const definedTokens = tokens.filter(function return_first(first) {
    return first;
  });

  return definedTokens;
}
