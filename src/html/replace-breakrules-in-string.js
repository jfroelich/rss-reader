// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns a modified version of the input string where <br> elements were
// removed.
// The function is named very specifically to reduce confusion with the
// function filterBreakruleElements from the document-transforms. Eventually,
// I should think about how to merge the two functions into a single function
// that operates on either a string or a document. Alternatively, maybe
// the caller (e.g. searchGoogleFeeds) could generate a document and use the
// same filter, but the problem there is that a document feels too heavy
// for simple string manipulation.

function replaceBreakrulesInString(string) {
  'use strict';
  if(string) {

    // Because the source could have text immediately adjacent
    // we replace with a space instead of an empty string.

    return string.replace(/<\s*br\s*>/gi, ' ');
  }
}
