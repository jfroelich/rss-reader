// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Remove trimmable nodes from the start and end of the document.
function sanity_trim_document(document) {
  // Restrict the scope of the descendants of body
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const firstChild = bodyElement.firstChild;
  if(firstChild) {
    sanity_remove_trimmable_nodes_by_step(firstChild, 'nextSibling');

    // Now start from the last child. This block is nested here because there
    // could only possibly be a last child if there was a first.
    // Although having a first child indicates that lastChild would be defined,
    // the body may have been emptied, so we still need to check again. The
    // second check if last is different is just a theoretical optimization
    // because it avoids the function call in the simple case.
    const lastChild = bodyElement.lastChild;
    if(lastChild && lastChild !== firstChild) {
      sanity_remove_trimmable_nodes_by_step(bodyElement.lastChild,
        'previousSibling');
    }
  }
}

// A set of element node names that are considered trimmable. This generally
// corresponds to VOID nodes as defined in the spec. However, not all void
// nodes are analogous to whitespace.
const SANITY_TRIMMABLE_VOID_ELEMENTS = {
  'BR': 1,
  'HR': 1,
  'NOBR': 1
};

// Walk in the step direction removing trimmable nodes. May include the start
// node if it is trimmable.
// TODO: seems like duplication or something of a similar issue with filtering
// leaves in leaf.js. Are the operations are associative?
function sanity_remove_trimmable_nodes_by_step(startNode, step) {
  // A node is trimmable when it is:
  // 1) A named element
  // 2) A whitespace only or empty text node

  // Caching the constant so that it does not do a property lookup per each
  // loop iteration. I am not sure if this matters.
  const TEXT = Node.TEXT_NODE;

  // We could use startNode itself as a mutable variable, but I prefer never to
  // write to a parameter.
  let node = startNode;

  // This could be initialized to null, but I init to the variable type with
  // the hope that it gives a hint to the interpreter.
  let sibling = startNode;

  // TODO: I think this loop can be simplified. I don't like having a complex
  // condition in the loop head.

  while(node && (node.nodeName in SANITY_TRIMMABLE_VOID_ELEMENTS ||
    (node.nodeType === TEXT && !node.nodeValue.trim()))) {
    sibling = node[step];
    node.remove();
    node = sibling;
  }
}
