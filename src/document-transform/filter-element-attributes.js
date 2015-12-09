// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const RETAIN_ATTRIBUTE_NAMES = new Set([
  'alt',
  'href',
  'src',
  'title'
]);


// Removes attributes from elements in the document, except for href/src
function filterElementAttributes(document) {
  const elements = document.getElementsByTagName('*');
  let attributes = null;
  let name = '';
  let element = null;
  for(let i = 0, j = 0, len = elements.length; i < len; i++) {
    element = elements[i];
    attributes = element.attributes;

    // NOTE: attributes is a live NodeList, so we iterate in reverse to
    // avoid issues with mutation while iterating.
    j = attributes ? attributes.length : 0;
    while(j--) {
      name = attributes[j].name;
      if(!RETAIN_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttribute(name);
      }
    }
  }
}

// Exports
this.filterElementAttributes = filterElementAttributes;

} // END ANONYMOUS NAMESPACE
