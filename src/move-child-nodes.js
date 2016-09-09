// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: delete file, no longer in use

// Moves the child nodes from srcElement to destElement. The elements
// may be in different documents. This uses a fragment for better performance
// when the document containing the destination element is live but the document
// containing the source element is inert.
function moveChildNodes(srcElement, destElement) {
  // Create the fragment from within the source doc, so that it is also
  // flagged as inert.
  const srcDoc = srcElement.ownerDocument;
  const frag = srcDoc.createDocumentFragment();
  // Move all the source elements children into the fragment
  // Because each append removes, the next node becomes the first child, hence
  // the oddity here of setting node to first child repeatedly.
  for(let node = srcElement.firstChild; node; node = srcElement.firstChild) {
    frag.appendChild(node);
  }
  // Append the fragment to the destination element in a single move. Given
  // how fragments work, the frag parent itself is implicitly ignored and just
  // its children are appended.

  // NOTE: this is where the importing of nodes from an inert context into a
  // live context implicitly occurs. If there is XSS, this is the prime spot.
  destElement.appendChild(frag);
}
