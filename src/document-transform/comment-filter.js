// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const CommentFilter = {};

// Note that the rest parameter is ignored
// TODO: maybe take another look at the whole conditional comments 
// mess of Internet Explorer and consider some more nuanced removal
CommentFilter.transform = function(document, rest) {

  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  let comment = it.nextNode();
  while(comment) {
    comment.remove();
    comment = it.nextNode();
  }
};
