// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const TrimDocument = {};

{ // BEGIN ANONYMOUS NAMESPACE

TrimDocument.transform = function(document, rest) {
  
  const root = document.body;

  if(!root) {
  	// console.debug('document.body is undefined');
  	return;
  }

  let sibling = root;
  let node = root.firstChild;
  while(isTrimmableElement(node)) {
    sibling = node.nextSibling;
    console.debug('Trimming %o from front', node);
    node.remove();
    node = sibling;
  }

  node = root.lastChild;
  while(isTrimmableElement(node)) {
    sibling = node.previousSibling;
    console.debug('Trimming %o from end', node);
    node.remove();
    node = sibling;
  }
};

function isTrimmableElement(element) {
  if(!element) return false;
  if(element.nodeType !== Node.ELEMENT_NODE) return false;
  let name = element.localName;
  if(name === 'br') return true;
  if(name === 'hr') return true;
  if(name === 'p' && !element.firstChild) return true;
  return false;
}

} // END ANONYMOUS NAMESPACE
