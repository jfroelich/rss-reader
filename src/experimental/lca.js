import assert from "/src/utils/assert.js";

// NOTE: this functionality is working, but it is only in use by an experimental module, so I have
// decided to leave it out of the dom folder.

// TODO: change findLCA to varargs, find the LCAs of whatever args given, instead of only 2.
// In other words, change to (...nodes).
// TODO: look again at native functionality, I think something in Range already does this?


// Find the lowest common ancestor of two nodes.

// Assumes node1 does not contain node2, and node2 does not contain node1. In other words assume
// the nodes are not 'connected' in the DAG.
//
// Adapted from https://stackoverflow.com/questions/3960843
//
// Returns an object with properties ancestor, d1, and d2. ancestor is the lowest common ancestor.
// d1 is the distance from node1 to the ancestor, in terms of edge traversals. d2 is the distance
// from node2 to the ancestor.
export default function findLCA(node1, node2) {
  assert(node1 instanceof Node);
  assert(node2 instanceof Node);
  assert(node1 !== node2);
  assert(node1.ownerDocument === node2.ownerDocument);

  const ancestors1 = getAncestors(node1);
  const ancestors2 = getAncestors(node2);

  // The +1s are for the immediate parent steps
  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j]) {
        return {ancestor: ancestor1, d1: i + 1, d2: j + 1};
      }
    }
  }

  assert(false);
}

// Returns an array of ancestors, from deepest to shallowest. The node itself is excluded.
function getAncestors(node) {
  assert(node instanceof Node);
  const ancestors = [];
  for(let parent = node.parentNode; parent; parent = parent.parentNode) {
    ancestors.push(parent);
  }
  return ancestors;
}
