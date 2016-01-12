// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Replaces an element with its child nodes
// NOTE: not optimized for live documents
// TODO: redesign so that this uses fewer dom operations
// TODO: do additional research into whether there is some native method that
// provides sufficiently similar functionality.
function unwrapElement(element) {
  'use strict';

  const parent = element.parentElement;

  // We require a parent to use insertBefore, but also because the idea of
  // unwrapping an element does not make sense without a parent
  if(parent) {
    let firstNode = element.firstChild;
    while(firstNode) {

      // Move the node to its new location outside of and before the element
      parent.insertBefore(firstNode, element);

      firstNode = element.firstChild;
    }
    element.remove();
  }
}
