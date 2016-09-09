// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Filters various anchors from the document.
// @param doc {Document}
// TODO: should this be unwrapping instead of removing?
function filterInvalidAnchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
}

// Eventually this could look for other invalid patterns, but currently I am
// only focusing on one. I think it is related to a Macromedia template.
function isInvalidAnchor(anchor) {
  console.assert(anchor);
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

this.filterInvalidAnchors = filterInvalidAnchors;

} // End file block scope
