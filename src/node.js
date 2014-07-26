// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.node = {};

// TODO: now that I think about it, this should be deprecated
// and the caller should just use something like
// Node.prototype.removeChild that is bound to parent, or just use
// Node.prototype.remove bound to node.
// A simple helper for passing to iterators like forEach
lucu.node.remove = function(node) {

  // This uses the new node.remove function instead of
  // node.parentNode.removeChild(node).

  if(node) {
    node.remove();
  }
};

// TODO: is there a native functional way to accomplish this?
lucu.node.getValue = function(node) {
  return node.nodeValue;
};

/**
 * A simple helper to use forEach against traversal API.
 *
 * @param element - the root element, only nodes under the root are iterated. The
 * root element itself is not 'under' itself so it is not included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
lucu.node.forEach = function(element, type, func, filter) {
  var ownerDocument = element.ownerDocument;
  var iterator = ownerDocument.createNodeIterator(element, type, filter);
  var node;

  while(node = iterator.nextNode()) {
    func(node);
  }
};
