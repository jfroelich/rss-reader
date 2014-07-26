// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// A simple helper for passing to iterators like forEach
function removeNode(node) {

  // This uses the new node.remove function instead of
  // node.parentNode.removeChild(node).

  if(node) {
    node.remove();
  }
}


// TODO: is there a native functional way to accomplish this?
function getNodeValue(node) {
  return node.nodeValue;
}


/**
 * A simple helper to use forEach against traversal API.
 *
 * @param element - the root element, only nodes under the root are iterated. The
 * root element itself is not 'under' itself so it is not included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
function eachNode(element, type, func, filter) {
  var ownerDocument = element.ownerDocument;
  var iterator = ownerDocument.createNodeIterator(element, type, filter);
  var node;

  while(node = iterator.nextNode()) {
    func(node);
  }
}
