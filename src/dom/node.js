'use strict';

// import base/assert.js

// Returns true if the first parameter is of type Node
function node_is_node(node) {
  return node instanceof Node;
}

// Find the lowest common ancestor of two nodes. Assumes
// node1 does not contain node2, and node2 does not contain node1.
//
// Adapted from https://stackoverflow.com/questions/3960843
// Returns an object with properties ancestor, d1, and d2. ancestor is the
// lowest common ancestor. d1 is the distance from node1 to the ancestor, in
// terms of edge traversals. d2 is the distance from node2 to the ancestor.
//
// TODO: change to varargs, find the LCAs of whatever args given, instead of
// only 2. change to (...nodes)
function node_find_lca(node1, node2) {
  ASSERT(node_is_node(node1));
  ASSERT(node_is_node(node2));

  // This function should never be called on the same node
  ASSERT(node1 !== node2);

  // This function should only be called on two nodes from the same document
  ASSERT(node1.ownerDocument === node2.ownerDocument);

  const ancestors1 = node_get_ancestors(node1);
  const ancestors2 = node_get_ancestors(node2);

  // The +1s are for the immediate parent steps
  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j]) {
        return {
          'ancestor': ancestor1,
          'd1': i + 1,
          'd2': j + 1
        };
      }
    }
  }

  ASSERT_NOT_REACHED();
}

// Returns an array of ancestors, from deepest to shallowest.
// The node itself is not included.
function node_get_ancestors(node) {
  ASSERT(node_is_node(node));
  const ancestors = [];
  for(let ancestor = node.parentNode; ancestor;
    ancestor = ancestor.parentNode) {
    ancestors.push(node);
  }

  return ancestors;
}
