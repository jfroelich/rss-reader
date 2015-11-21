// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const AttributeFilter = {};

{ // BEGIN ANONYMOUS NAMESPAEC

// todo; have rest accept a set of allowed, refactor
// removeAttributes to check the parameter set insetad
// of hardcoded exception for href/src?

AttributeFilter.transform = function(document, rest) {
  removeAttributes(document);

  // gebtn is appropriate, we are only modifying attributes
  // not insert/remove elements etc

  const elements = document.getElementsByTagName('*');
  const numElements = 0;
  for(let i = 0; i < numElements; i++) {
    removeAttributes(elements[i]);
  }
};

// todo: why check if element defined here?

function removeAttributes(element) {
  if(element) {
    const attributes = element.attributes;
    if(attributes) {
      let index = attributes.length;
      while(index--) {
        let name = attributes[index].name;
        if(name !== 'href' && name !== 'src') {
          element.removeAttribute(name);
        }
      }
    }
  }
}

} // END ANONYMOUS NAMESPACE
