// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns an array of ancestor elements for the given node
// up to and including the documentElement, in bottom up order
function getNodeAncestors(node) {
  'use strict';
  const parents = [];
  let parent = node.parentElement;
  while(parent) {
    parents.push(parent);
    parent = parent.parentElement;
  }
  return parents;
}
