// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Filters various anchors from the document.
// TODO: should this be unwrapping instead of removing?
function filter_invalid_anchors(doc) {
  console.assert(doc);
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(is_invalid_anchor(anchor)) {
      anchor.remove();
    }
  }
}

// Eventually this could look for other invalid patterns, but currently I am
// only focusing on one. I think it is related to a Macromedia template.
function is_invalid_anchor(anchor) {
  console.assert(anchor);
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

this.filter_invalid_anchors = filter_invalid_anchors;

} // End file block scope
