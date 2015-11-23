// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const AttributeFilter = {};

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: have rest accept a set of allowed, refactor
// removeAttributes to check the parameter set insetad
// of hardcoded exception for href/src?

function AttributeFilter$Transform(document, rest) {
  removeAttributes(document.documentElement);

  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    removeAttributes(elements[i]);
  }
};

// Export
AttributeFilter.transform = AttributeFilter$Transform;

function removeAttributes(element) {

  const attributes = element.attributes;
  if(!attributes) return;

  let index = attributes.length;
  while(index--) {
    let name = attributes[index].name;
    if(name !== 'href' && name !== 'src') {
      element.removeAttribute(name);
    }
  }
}

} // END ANONYMOUS NAMESPACE
