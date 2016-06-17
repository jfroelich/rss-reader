// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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
function filterArticleTitle(title) {

  // TODO: now that i moved tokenize back into this function has a helper,
  // I probably don't even need to use it as a function, I can just inline
  // it

  function tokenize(string) {
    if(!string) {
      return [];
    }

    const tokens = string.split(/s+/);
    const definedTokens = tokens.filter(returnFirst);
    return definedTokens;
  }

  function returnFirst(first) {
    return first;
  }

  if(!title)
    return;
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;
  const trailingText = title.substring(index + 1);
  const terms = tokenize(trailingText);
  if(terms.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
}
