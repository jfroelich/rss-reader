// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Unwraps anchors that are not links to other pages
// Requires: unwrapElement
function filterNominalAnchors(document) {
  'use strict';

  // NOTE: we use querySelectorAll as opposed to getElementsByTagName
  // because we are possibly mutating the NodeList while iterating
  // forward
  const anchors = document.querySelectorAll('a');
  // Cache the length for performance
  const numAnchors = anchors.length;
  for(let i = 0, anchor, href; i < numAnchors; i++) {
    anchor = anchors[i];
    // Avoid modifying named anchors to maintain intra-page links
    // hasAttribute is sufficient here because authors rarely bother to
    // set the name attribute unless it is meaningful
    if(!anchor.hasAttribute('name')) {
      // Use getAttribute instead of the property to get the raw value
      // without any browser changes
      // Do not use hasAttribute because it returns true for whitespace
      // only attribute values
      href = anchor.getAttribute('href') || '';
      href = href.trim();
      if(!href) {
        unwrapElement(anchor);
      }
    }
  }
}
