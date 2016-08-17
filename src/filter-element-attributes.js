// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes most attributes from elements using a per element whitelist
// TODO: make less dry, maybe add helpers
// TODO: removeAttribute just does a lookup of the attribute again. Look
// into whether there is a simple way to remove an attribute if I already
// have the attribute node object.
function filter_element_attributes(document) {
  const elements = document.getElementsByTagName('*');

  // Iterate attributes in reverse to avoid issues with mutating a live
  // NodeList during iteration

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let elementName = element.nodeName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'SOURCE') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'A') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IFRAME') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IMG') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(let j = attributes.length - 1; j > -1; j--) {
        element.removeAttribute(attributes[j].name);
      }
    }
  }
}
