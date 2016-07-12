// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Moves the element's child nodes into the element's parent, preceding the
// element, and then removes the element. If a reference node is defined, this
// instead moves the element's child nodes into the parent of the reference
// node, and then removes the reference node.
//
// Padding is added around the child nodes to avoid issues with text that
// becomes adjacent as a result of removing the element.
//
// This is not optimized to work on a live document. The element, and the
// reference node if defined, should be located within an inert document.
function unwrapElement(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;

  // We can only unwrap if a parent node is defined. If there is no parent
  // node then unwrapping does not make sense.
  // TODO: in fact, I should probably not even check for it and just allow
  // an error to occur?
  if(!parent) {
    return;
  }

  const document = element.ownerDocument;

  // Pad left if following a text node
  // TODO: would insertAdjacentHTML be simpler?
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  // Move the child nodes
  insertChildrenBefore(element, target);

  // Pad right if preceding a text node
  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  target.remove();
}

// Inserts the children of the parentNode before the reference node
// TODO: this is used in multiple contexts, maybe this should be in its own
// file.
function insertChildrenBefore(parentNode, referenceNode) {
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}
