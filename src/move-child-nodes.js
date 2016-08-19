// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Moves the child nodes from source_el to dest_el. The elements
// may be in different documents. This uses a fragment for better performance
// when the document containing the destination element is live but the document
// containing the source element is inert.
function move_child_nodes(source_el, dest_el) {
  // Create the fragment from within the source doc, so that it is also
  // flagged as inert.
  const source_doc = source_el.ownerDocument;
  const frag = source_doc.createDocumentFragment();
  // Move all the source elements children into the fragment
  // Because each append removes, the next node becomes the first child, hence
  // the oddity here of setting node to first child repeatedly.
  for(let node = source_el.firstChild; node; node = source_el.firstChild) {
    frag.appendChild(node);
  }
  // Append the fragment to the destination element in a single move. Given
  // how fragments work, the frag parent itself is implicitly ignored and just
  // its children are appended.

  // NOTE: this is where the importing of nodes from an inert context into a
  // live context implicitly occurs. If there is XSS, this is the prime spot.
  dest_el.appendChild(frag);
}
