// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Moves the child nodes from sourceElement to destinationElement. The elements
// may be in different documents.
function moveChildNodes(sourceElement, destinationElement) {
  const sourceDocument = sourceElement.ownerDocument;
  const fragment = sourceDocument.createDocumentFragment();
  for(let node = sourceElement.firstChild; node;
    node = sourceElement.firstChild) {
    fragment.appendChild(node);
  }
  destinationElement.appendChild(fragment);
}
