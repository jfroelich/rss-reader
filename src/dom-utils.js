// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: some of these functions have nothing to do with each other and may be
// better implemented as separate functions in separate files.

'use strict';

const DOMUtils = {};

// Finds all elements matching the selector and removes them,
// in forward document order. In contrast to moveElementsBySelector, this
// will recursively remove elements that are descendants of elements already
// removed.
// NOTE: i tried to find a way to avoid visiting detached subtrees, but
// document.contains still returns true for a removed element. The only way
// seems to be to traverse upwards and checking if documentElement is still at
// the top of the ancestors chain. That is obviously too inefficient, and
// probably less efficient than just visiting descendants. The real tradeoff
// is whether the set of remove operations is slower than the time it takes
// to traverse. I assume traversal is faster, but not fast enough to merit it.
// TODO: use for..of once Chrome supports NodeList iterators
DOMUtils.removeElementsBySelector = function(document, selector) {
  const elements = document.querySelectorAll(selector);
  const length = elements.length;
  for(let i = 0; i < length; i++) {
    elements[i].remove();
  }
};

// The result is the same as removeElementsBySelector.
// If destination is undefined, then a dummy document is supplied.
// The basic idea here is that we perform fewer dom mutations by not removing
// elements in removed subtrees.
DOMUtils.moveElementsBySelector = function(source, destination, selector) {
  const elements = source.querySelectorAll(selector);
  const length = elements.length;
  destination = destination || document.implementation.createHTMLDocument();

  for(let i = 0, element; i < length; i++) {
    element = elements[i];
    if(element.ownerDocument === source) {
      destination.adoptNode(element);
    }
  }
};

// Create a custom iterator wrapper around NodeList because
// I do not want to modify NodeList.prototype and Chrome does not yet
// support iterable node lists
DOMUtils.createNodeListIterator = function(nodeList) {
  throw new Error('Not implemented');
};
