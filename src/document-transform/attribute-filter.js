// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes attributes from all elements in the document
// except for those named in the optional retainableSet
function filterAttributes(document, retainableSet) {
  'use strict';
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  let attributes = null;
  let name = '';
  let element = null;
  for(let i = 0, j = 0; i < numElements; i++) {
    element = elements[i];
    attributes = element.attributes;
    j = attributes ? attributes.length : 0;
    while(j--) {
      name = attributes[j].name;
      if(!retainableSet.has(name)) {
        element.removeAttribute(name);
      }
    }
  }
}
