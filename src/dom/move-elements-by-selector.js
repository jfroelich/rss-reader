// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

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
//
// @param source {Document}
// @param destination {Document}
// @param selector {String}
// @returns void

function moveElementsBySelector(source, destination, selector) {
  'use strict';
  const elements = source.querySelectorAll(selector);
  const length = elements.length;
  destination = destination || document.implementation.createHTMLDocument();

  for(let i = 0, element; i < length; i++) {
    element = elements[i];
    if(element.ownerDocument === source) {
      destination.adoptNode(element);
    }
  }
}
