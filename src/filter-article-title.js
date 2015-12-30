// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

// Attempts to filter publisher information from an article's title.
// The input data generally looks like 'Article Title - Delimiter - Publisher'.
// The basic approach involves looking for an end delimiter, and if one is
// found, checking the approximate number of words following the delimiter,
// and if the number is less than a given threshold, returning a new string
// without the final delimiter or any of the words following it. This uses the
// threshold condition to reduce the chance of confusing the title with the
// the publisher in the case that there is an early delimiter, based on the
// assumption that the title is usually longer than the pubisher, or rather,
// that the publisher's name is generally short.
//
// There are probably some great enhancements that could be done, such as not
// truncating in the event the resulting title would be too short, as in, the
// the resulting title would not contain enough words. We could also consider
// comparing the number of words preceding the final delimiter to the number
// of words trailing the final delimiter. I could also consider trying to
// remove the publisher when it is present as a prefix, but this seems to be
// less frequent.
//
// @param title {String}
// @returns {String}

function filterArticleTitle(title) {

  // While I would prefer to fail fast, checking here helps reduce caller
  // boilerplate. We're changing the definition of the function by doing
  // this by stating that we tolerate nulls. We still fail in other cases
  // such as when using the wrong variable type but that is expected behavior.
  if(!title) {
    return;
  }

  // The extra spaces in the queries below are key to avoiding truncation
  // of hyphenated terms

  let index = title.lastIndexOf(' - ');

  if(index === -1) {
    index = title.lastIndexOf(' | ');
  }

  if(index === -1) {
    index = title.lastIndexOf(' : ');
  }

  if(index === -1) {
    return title;
  }

  const trailingText = title.substring(index + 1);
  const terms = tokenize(trailingText);

  if(terms.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
}

// Export a global. 'this' usually references window.
this.filterArticleTitle = filterArticleTitle;

// Split the string into an array of words
function tokenize(string) {

  // A quick and dirty RegExp suffices here. I am not truly concerned about
  // the accuracy
  // NOTE: i am defining this expression locally with the expectation that the
  // js engine intelligently hoists it
  const WHITESPACE_PATTERN = /s+/;
  const tokens = string.split(WHITESPACE_PATTERN);

  // String.prototype.split sometimes yields empty strings, so we have to
  // do the extra step of filtering those out. The identify function simply
  // returns the current value, which filter then tests for truthiness, which
  // equates to definedness, which results in undefined values or empty strings
  // being filtered from the array.
  const definedTokens = tokens.filter(identity);
  return definedTokens;
}

function identity(value) {
  return value;
}

} // END FILE SCOPE
