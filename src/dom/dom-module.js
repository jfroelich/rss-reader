// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Provides functions for manipulating and searching the DOM.
function DOMModule() {}

// Create a custom iterator wrapper around NodeList because
// I do not want to modify NodeList.prototype and Chrome does not yet
// support iterable node lists. So this is a placeholder function to remind me
// of this idea of how to allow all my other iterating functions that work
// with nodelists to use for..of.
DOMModule.prototype.createNodeListIterator = function(nodeList) {
  'use strict';
  throw new Error('Not implemented');
};

// Returns true if the element is a figure element
// TODO: look into the canonical way of doing this. For example, is it more
// standard to use tagName, or instanceof like in the case of
// element instanceof HTMLFigureElement?
DOMModule.prototype.isFigureElement = function(element) {
  'use strict';
  return element.localName === 'figure';
};

// Finds the associated caption for an image element
// TODO: optimize? For example, maybe I should just be searching ancestors
// and returning the first matching ancestor, instead of storing all ancestors
// in an array. Maybe I need a findAncestor function? However, this involves
// not using the native Array.prototype.find function, so I am not sure.
// TODO: rename to selectImageCaption or selectCaption as only images
// have captions? or can other elements have captions, like tables?
DOMModule.prototype.findImageCaption = function(image) {
  'use strict';
  const isFigureElement = DOMModule.prototype.isFigureElement;
  const getNodeAncestors = DOMModule.prototype.getNodeAncestors;
  const ancestors = getNodeAncestors(image);
  const figure = ancestors.find(isFigureElement);
  let caption = null;
  if(figure) {
    caption = figure.querySelector('figcaption');
  }
  return caption;
};

// Returns an array of ancestor elements for the given node
// up to and including the documentElement, in bottom up order
DOMModule.prototype.getNodeAncestors = function(node) {
  'use strict';
  const ancestors = [];
  let parentElement = node.parentElement;
  while(parentElement) {
    ancestors.push(parentElement);
    parentElement = parent.parentElement;
  }
  return ancestors;
};

// Moves elements matching the selector query from the source document into
// the destination document. This function iterates over elements in the node
// list generated as a result of querySelectorAll. Once an element is moved,
// its children are implicitly also moved. If a child also matches the selector
// query, it is not moved again.
// This function works similarly to removeElementsBySelector, but potentially
// performs fewer dom manipulations because of how it avoids manipulating
// child elements of moved elements. In theory, this can lead to better
// performance. This also achieves better technical accuracy, because the fact
// that removed/moved child elements remain in the node list even after a parent
// was removed/moved, is undesirable behavior. Unfortunately, I cannot think of
// a way to accomplish the desired behavior using the native API provided.
//
// If destination is undefined, then a dummy document is supplied, which is
// discarded when the function completes, which results in the elements being
// simply removed from the source document.
// TODO: use for..of once Chrome supports NodeList iterators
//
// @param source {Document}
// @param destination {Document}
// @param selector {String}
// @returns void
DOMModule.prototype.moveElementsBySelector = function(source,
  destination, selector) {
  'use strict';
  const elements = source.querySelectorAll(selector);
  const numElements = elements.length;
  destination = destination || document.implementation.createHTMLDocument();

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(element.ownerDocument === source) {
      destination.adoptNode(element);
    }
  }
};

// Finds all elements with the given tagName and removes them,
// in reverse document order. This will remove elements that do not need to
// be removed because an ancestor of them will be removed in a later iteration.
// NOTE: this ONLY works in reverse. getElementsByTagName returns a LIVE
// NodeList/HTMLCollection. Removing elements from the list while iterating
// screws up all later index access when iterating forward. To avoid this,
// use a non-live list such as the one returned by querySelectorAll.
DOMModule.prototype.removeElementsByName = function(document, tagName) {
  'use strict';
  const elements = document.getElementsByTagName(tagName);
  const numElements = elements.length;
  for(let i = numElements - 1; i > -1; i--) {
    elements[i].remove();
  }
};

// Finds all elements matching the selector and removes them,
// in forward document order. In contrast to moveElementsBySelector, this
// removes elements that are descendants of elements already removed.
// NOTE: i tried to find a way to avoid visiting detached subtrees, but
// document.contains still returns true for a removed element. The only way
// seems to be to traverse upwards and checking if documentElement is still at
// the top of the ancestors chain. That is obviously too inefficient, and
// probably less efficient than just visiting descendants. The real tradeoff
// is whether the set of remove operations is slower than the time it takes
// to traverse. I assume traversal is faster, but not fast enough to merit it.
// TODO: use for..of once Chrome supports NodeList iterators
DOMModule.prototype.removeElementsBySelector = function(document, selector) {
  'use strict';
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// Replaces an element with its child nodes
// TODO: not optimized for live documents, redesign so that this uses fewer
// dom operations, maybe use a DocumentFragment
// TODO: do additional research into whether there is some native method that
// provides sufficiently similar functionality.
// TODO: should I be removing parentless elements anyway? move element.remove
// outside of the if block?
// TODO: i recently noticed jQuery provides some kind of unwrap function,
// look into it more and compare it to this
DOMModule.prototype.unwrapElement = function(element) {
  'use strict';
  const parent = element.parentElement;
  if(parent) {
    let firstNode = element.firstChild;
    while(firstNode) {
      parent.insertBefore(firstNode, element);
      firstNode = element.firstChild;
    }
    element.remove();
  }
};
