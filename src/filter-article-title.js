// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filter_article_title(title) {
  console.assert(title, 'title is required');

  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  const trailingText = title.substring(index + 1);

  const tokens = trailingText.split(/\s+/g);

  const definedTokens = tokens.filter(function(tokenString) {
    return tokenString;
  });

  if(definedTokens.length < 5) {
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
}
