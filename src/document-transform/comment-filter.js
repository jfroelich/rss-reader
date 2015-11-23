// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const CommentFilter = {};

// TODO: maybe just move this into another transform given its simplicity
// TODO: maybe take another look at the whole conditional comments 
// mess of Internet Explorer and consider some more nuanced removal
CommentFilter.transform = function CommentFilter$Transform(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  let comment = it.nextNode();
  while(comment) {
    comment.remove();
    comment = it.nextNode();
  }
};
