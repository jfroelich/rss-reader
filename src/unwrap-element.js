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
//
// I also experimented with recreation of an entire virtual dom. I made it as
// efficient as possible. It turns out to be terribly slow.
//
// TODO: I did notice speedup in move-child-nodes. Try using a document
// fragment here. Append nodes into the document fragment, then insert the
// document fragment.

function unwrapElement(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;

  // We can only unwrap if a parent node is defined. If there is no parent
  // node then unwrapping does not make sense.

  if(!parent) {
    return;
  }

  const document = element.ownerDocument;

  // Pad left if next to a text node
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  // Move the child nodes
  insertChildrenBefore(element, target);

  // Pad right if next to a text node
  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  target.remove();
}

// Inserts the children of the parentNode before the reference node. This
// function is not optimized for working with live documents. Note that the
// parent node may be equal to the reference node.
// I have not found a way to efficiently move a node's child nodes using a
// single operation. The closest I got was using
// parentNode.insertAdjacentHTML(childNode.innerHTML, childNode). Profiling
// showed this was slower than moving individual nodes with insertBefore. I
// suppose this is due to all the marshalling, and the implicit XSS checks.
function insertChildrenBefore(parentNode, referenceNode) {
  // Get the parent of the reference node. Assume it always exists.
  const referenceParent = referenceNode.parentNode;
  // Move the children one a time, maintaining child order.
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}
