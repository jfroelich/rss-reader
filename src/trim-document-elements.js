// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: i think trimDocument may be a better name than trimDocumentElements,
// because we are not trimming individual elements, we are trying to trim
// the document, as if it were a string

// NOTE: i wonder if isTrimmable should be defined externally and be
// something similar to 'isLeaf' function that is used to prune
// empty elements anywhere in the document. If so, maybe this file
// should be merged with that file.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Removes trimmable elements from the start and end of the document
function trimDocumentElements(document) {
  const root = document.body;

  if(!root) {
    return;
  }

  let sibling = root;
  let node = root.firstChild;
  while(isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = root.lastChild;
  while(isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
}

this.trimDocumentElements = trimDocumentElements;

const ELEMENT_NODE = Node.ELEMENT_NODE;

function isTrimmableElement(element) {
  if(!element) return false;
  if(element.nodeType !== ELEMENT_NODE) return false;
  let name = element.localName;
  if(name === 'br') return true;
  if(name === 'hr') return true;
  if(name === 'p' && !element.firstChild) return true;
  return false;
}

} // END ANONYMOUS NAMESPACE
