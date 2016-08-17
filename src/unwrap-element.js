// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Moves the element's child nodes into the element's parent, preceding the
// element, and then removes the element. If a reference node is defined, this
// instead moves the element's child nodes into the parent of the reference
// node, and then removes the reference node.
// Padding is added around the child nodes to avoid issues with text that
// becomes adjacent as a result of removing the element.
// This is not optimized to work on a live document. The element, and the
// reference node if defined, should be located within an inert document.
function unwrap_element(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;
  console.assert(parent);
  const document = element.ownerDocument;
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  insert_children_before(element, target);

  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  target.remove();
}

// Inserts the children of the parentNode before the reference node
function insert_children_before(parentNode, referenceNode) {
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}
