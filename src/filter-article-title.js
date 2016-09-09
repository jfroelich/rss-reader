// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filterArticleTitle(title) {
  console.assert(title);

  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  const trailingText = title.substring(index + 1);

  const tokens = trailingText.split(/\s+/g);

  // Split can yield empty strings, filter them
  const definedTokens = tokens.filter(function(token) {
    return token;
  });

  if(definedTokens.length < 5) {
    const new_title = title.substring(0, index).trim();
    return new_title;
  }

  return title;
}
